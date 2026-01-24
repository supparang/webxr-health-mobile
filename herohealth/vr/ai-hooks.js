/* === /herohealth/vr/ai-hooks.js ===
HHA AI Hooks — PRODUCTION (safe, deterministic-ready)
✅ Enabled only when: run=play AND ?ai=1
✅ Auto-disabled in: run=research / run=practice
✅ Emits:
  - groups:ai:pred { pMiss10s, pMiniFail, f }
  - groups:ai:dd   { spawnMul, sizeMul, wrongDelta, junkDelta, lifeMul, reason }
  - hha:coach      { text, mood, reason, explain }
✅ Pattern hooks:
  - groups:ai:pattern { mode, payload } (optional; engine may ignore)
Notes:
- Predictor is "ML-ready lightweight" (feature-based). You can swap to TFJS later.
*/

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(!WIN || !DOC) return;
  if(WIN.__HHA_AI_HOOKS_LOADED__) return;
  WIN.__HHA_AI_HOOKS_LOADED__ = true;

  // ---------- utils ----------
  const clamp=(v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs=()=> (WIN.performance && performance.now) ? performance.now() : Date.now();
  const emit=(n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(_){} };

  const qsParam=(k,d=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; }
  };

  const runMode=()=> String(qsParam('run','play')||'play').toLowerCase();
  const aiOn = ()=> (qsParam('ai','0') === '1') && (runMode()==='play');

  // deterministic-friendly seeded rng (optional)
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return ()=>{ s = (Math.imul(1664525,s)+1013904223)>>>0; return s/4294967296; };
  }

  // ---------- state ----------
  const S = {
    enabled: false,
    seed: String(qsParam('seed', Date.now())),
    rng: null,

    // rolling window (10s)
    winMs: 10000,
    events: [], // {t, type} type: goodHit, wrongHit, junkHit, miss, miniFail, miniClear

    // latest signals
    f: {
      left: 0,
      score: 0,
      combo: 0,
      misses: 0,
      acc: 0,
      pressure: 0,
      miniOn: false,
      miniNeed: 0,
      miniNow: 0,
      miniForbidJunk: false
    },

    // DD output (smoothed)
    dd: { spawnMul: 1.0, sizeMul: 1.0, wrongDelta: 0.0, junkDelta: 0.0, lifeMul: 1.0 },
    lastDdAt: 0,
    lastPredAt: 0,

    // coach
    lastCoachAt: 0,
    coachCooldownMs: 2400
  };

  function reset(){
    S.events.length = 0;
    S.f = { left:0, score:0, combo:0, misses:0, acc:0, pressure:0,
            miniOn:false, miniNeed:0, miniNow:0, miniForbidJunk:false };
    S.dd = { spawnMul:1.0, sizeMul:1.0, wrongDelta:0.0, junkDelta:0.0, lifeMul:1.0 };
    S.lastDdAt = 0;
    S.lastPredAt = 0;
    S.lastCoachAt = 0;
  }

  function pushEvt(type){
    const t = nowMs();
    S.events.push({t, type});
    // prune
    const cut = t - S.winMs;
    while(S.events.length && S.events[0].t < cut) S.events.shift();
  }

  function summarizeWindow(){
    const t = nowMs();
    const cut = t - S.winMs;
    let good=0, wrong=0, junk=0, miss=0;
    for(const e of S.events){
      if(e.t < cut) continue;
      if(e.type==='goodHit') good++;
      else if(e.type==='wrongHit') wrong++;
      else if(e.type==='junkHit') junk++;
      else if(e.type==='miss') miss++;
    }
    const judged = good + wrong + junk + miss;
    const acc = judged>0 ? (good / judged) : 0;
    const missRate = judged>0 ? (miss / judged) : 0;
    const badRate  = judged>0 ? ((wrong+junk+miss) / judged) : 0;
    return { good, wrong, junk, miss, judged, acc, missRate, badRate };
  }

  // --------- Predictor (ML-ready lightweight) ----------
  // Output 0..1: pMiss10s, pMiniFail
  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  function predict(){
    const W = summarizeWindow();

    // features (normalized)
    const fAcc = W.acc;                // 0..1
    const fBad = W.badRate;            // 0..1
    const fCombo = clamp(S.f.combo/14, 0, 1);
    const fPress = clamp(S.f.pressure/3, 0, 1);
    const fMiniT = S.f.miniOn ? 1 : 0;
    const fMiniGap = S.f.miniOn ? clamp((S.f.miniNeed - S.f.miniNow)/Math.max(1,S.f.miniNeed), 0, 1) : 0;

    // pMiss10s: risk of near-term miss bursts
    // (handcrafted weights; swap to learned weights later)
    const zMiss =
      (+2.2 * fBad) +
      (+1.2 * fPress) +
      (+0.8 * (1-fCombo)) +
      (-1.6 * fAcc);

    const pMiss10s = sigmoid(zMiss); // 0..1

    // pMiniFail: only meaningful when mini is on
    const zMini =
      (+2.4 * fMiniGap) +
      (+1.0 * fBad) +
      (+0.8 * fPress) +
      (-1.2 * fAcc);

    const pMiniFail = S.f.miniOn ? sigmoid(zMini) : clamp(0.15 + 0.75*pMiss10s, 0, 1);

    return { pMiss10s, pMiniFail, W };
  }

  // --------- Difficulty Director (2-2) ----------
  // Goal: keep flow "สนุก/ท้าทาย" แต่ไม่โกง
  // - ถ้าเสี่ยงสูง: ชะลอ spawn นิด + ขยาย size นิด + ลด decoy/junk นิด
  // - ถ้าเสี่ยงต่ำมาก + combo สูง: เร่ง spawn นิด + ลด size นิด + เพิ่ม decoy เล็กน้อย
  function computeDD(pred){
    const { pMiss10s, pMiniFail, W } = pred;

    // base targets
    let spawnMul = 1.0;
    let sizeMul  = 1.0;
    let wrongDelta = 0.0;
    let junkDelta  = 0.0;
    let lifeMul = 1.0;
    let reason = 'steady';

    const comboHigh = (S.f.combo >= 9);
    const pressHigh = (S.f.pressure >= 2);

    if (pMiss10s >= 0.70 || pMiniFail >= 0.70 || pressHigh){
      spawnMul = 1.10;        // ช้าลง (interval * 1.10)
      sizeMul  = 1.06;        // ใหญ่ขึ้นนิด
      lifeMul  = 1.06;        // อยู่ได้นานขึ้นนิด
      wrongDelta = -0.03;     // ลดหลอก
      junkDelta  = -0.02;
      reason = 'assist_high_risk';
    } else if (pMiss10s <= 0.28 && comboHigh && W.acc >= 0.75){
      spawnMul = 0.92;        // เร็วขึ้น
      sizeMul  = 0.96;        // เล็กลงนิด
      lifeMul  = 0.96;
      wrongDelta = +0.02;     // เพิ่มหลอกนิด (พอท้าทาย)
      junkDelta  = +0.01;
      reason = 'push_flow';
    } else if (pMiss10s <= 0.40 && W.acc >= 0.70){
      spawnMul = 0.97;
      sizeMul  = 0.99;
      lifeMul  = 0.99;
      wrongDelta = +0.01;
      junkDelta  = 0.00;
      reason = 'mild_push';
    } else if (pMiss10s >= 0.55 && W.acc <= 0.55){
      spawnMul = 1.05;
      sizeMul  = 1.03;
      lifeMul  = 1.03;
      wrongDelta = -0.02;
      junkDelta  = -0.01;
      reason = 'mild_assist';
    }

    // safety bounds (fair)
    spawnMul = clamp(spawnMul, 0.86, 1.18);
    sizeMul  = clamp(sizeMul, 0.92, 1.10);
    lifeMul  = clamp(lifeMul, 0.90, 1.12);
    wrongDelta = clamp(wrongDelta, -0.06, +0.06);
    junkDelta  = clamp(junkDelta,  -0.05, +0.05);

    return { spawnMul, sizeMul, wrongDelta, junkDelta, lifeMul, reason };
  }

  function smoothDD(next){
    // exponential smoothing to avoid jitter
    const a = 0.35;
    const cur = S.dd;
    S.dd = {
      spawnMul: cur.spawnMul + a*(next.spawnMul - cur.spawnMul),
      sizeMul:  cur.sizeMul  + a*(next.sizeMul  - cur.sizeMul),
      wrongDelta: cur.wrongDelta + a*(next.wrongDelta - cur.wrongDelta),
      junkDelta:  cur.junkDelta  + a*(next.junkDelta  - cur.junkDelta),
      lifeMul:    cur.lifeMul    + a*(next.lifeMul    - cur.lifeMul),
    };
  }

  // --------- Explainable Coach (2-3) ----------
  function coach(text, mood, reason, explain){
    const t = nowMs();
    if(t - S.lastCoachAt < S.coachCooldownMs) return;
    S.lastCoachAt = t;
    emit('hha:coach', { text, mood: mood||'neutral', reason: reason||'ai', explain: explain||'' });
  }

  function maybeCoach(pred){
    const { pMiss10s, pMiniFail, W } = pred;

    if(S.f.miniOn){
      const gap = (S.f.miniNeed - S.f.miniNow);
      if(pMiniFail >= 0.70 && gap >= 2){
        coach(
          `MINI เสี่ยงไม่ทัน! ให้เลือกยิงเฉพาะหมู่ที่ถูกก่อน (${gap} เหลือ)`,
          'fever',
          'mini_risk_high',
          `pMiniFail=${Math.round(pMiniFail*100)}%, acc10s=${Math.round(W.acc*100)}%`
        );
        return;
      }
      if(S.f.miniForbidJunk && pMiniFail >= 0.55){
        coach(
          'MINI ห้ามโดนขยะ! ถ้าไม่ชัวร์ “หยุดยิง” ดีกว่ายิงมั่ว',
          'neutral',
          'mini_forbid_junk',
          `forbidJunk=1, bad10s=${Math.round(W.badRate*100)}%`
        );
        return;
      }
    }

    if(pMiss10s >= 0.72){
      coach(
        'เสี่ยงพลาดสูง: ช้าลงครึ่งจังหวะ แล้วค่อยยิงทีละเป้า 🎯',
        'sad',
        'miss_risk_high',
        `pMiss10s=${Math.round(pMiss10s*100)}%, bad10s=${Math.round(W.badRate*100)}%`
      );
      return;
    }

    if(pMiss10s <= 0.28 && S.f.combo >= 9){
      coach(
        'กำลังไหลดีมาก! ลองเล็ง “เป้าที่อยู่ไกลกลางจอ” จะคุมคอมโบง่ายขึ้น 🔥',
        'happy',
        'flow_high',
        `combo=${S.f.combo}, acc10s=${Math.round(W.acc*100)}%`
      );
      return;
    }
  }

  // --------- Pattern Generator hooks (2C) ----------
  // Provide deterministic pattern suggestions (optional)
  function patternSeeded(){
    // example: a small suggestion package
    // (Engine may use or ignore)
    const r = S.rng ? S.rng() : Math.random();
    const mode = (r < 0.5) ? 'center_bias' : 'sweep_bias';
    const payload = (mode==='center_bias')
      ? { centerWeight: 0.62, edgesWeight: 0.38 }
      : { sweepDir: (S.rng && S.rng()<0.5) ? 'L2R' : 'R2L', sweepWeight: 0.58 };
    return { mode, payload };
  }

  // --------- Main tick ----------
  function tick(){
    if(!S.enabled) return;

    const t = nowMs();

    // Predict ~ every 1s
    if(t - S.lastPredAt >= 1000){
      S.lastPredAt = t;

      const pred = predict();
      emit('groups:ai:pred', { pMiss10s: pred.pMiss10s, pMiniFail: pred.pMiniFail, f: Object.assign({}, S.f) });

      // DD ~ every 1.2s (slightly slower than pred)
      if(t - S.lastDdAt >= 1200){
        S.lastDdAt = t;
        const next = computeDD(pred);
        smoothDD(next);
        emit('groups:ai:dd', Object.assign({}, S.dd, { reason: next.reason }));
      }

      // Coach
      maybeCoach(pred);

      // Optional Pattern hooks (only if ?aiPattern=1)
      if(qsParam('aiPattern','0')==='1'){
        const pat = patternSeeded();
        emit('groups:ai:pattern', pat);
      }
    }

    requestAnimationFrame(tick);
  }

  // --------- Event wiring ----------
  // Source events from engine/UI
  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    S.f.score = Number(d.score)||0;
    S.f.combo = Number(d.combo)||0;
    S.f.misses = Number(d.misses)||0;
  }, { passive:true });

  WIN.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail || {};
    // accuracyGoodPct is in 0..100
    S.f.acc = clamp((Number(d.accuracy)||0)/100, 0, 1);
  }, { passive:true });

  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    if(d.kind === 'miss'){
      pushEvt('miss');
    }
    if(d.kind === 'pressure'){
      S.f.pressure = Number(d.level)||0;
    }
  }, { passive:true });

  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    if(d.kind === 'good') pushEvt('goodHit');
    else if(d.kind === 'bad') {
      // if text contains -18 treat as junk, else wrong (simple heuristic)
      const txt = String(d.text||'');
      if(txt.includes('-18') || txt.toLowerCase().includes('junk')) pushEvt('junkHit');
      else pushEvt('wrongHit');
    } else if(d.kind === 'miss'){
      // (crosshair miss not counted in engine miss; still useful as signal)
      pushEvt('miss');
    }
  }, { passive:true });

  WIN.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};
    const miniOn = (typeof d.miniTitle === 'string') && d.miniTitle !== '—' && (Number(d.miniTotal)||0) > 1;
    S.f.miniOn = !!miniOn;
    S.f.miniNeed = Number(d.miniTotal)||0;
    S.f.miniNow  = Number(d.miniNow)||0;
    // detect forbid junk from title string
    S.f.miniForbidJunk = String(d.miniTitle||'').includes('ห้ามโดนขยะ');
  }, { passive:true });

  WIN.addEventListener('hha:end', ()=>{
    reset();
  }, { passive:true });

  // --------- init ----------
  function init(){
    const rm = runMode();
    if(rm !== 'play') {
      S.enabled = false;
      return;
    }
    S.enabled = aiOn();
    if(!S.enabled) return;

    const seed = String(qsParam('seed', Date.now()));
    S.seed = seed;
    S.rng = makeRng(hashSeed(seed + '::aihooks'));
    reset();

    // initial pattern hint (optional)
    if(qsParam('aiPattern','0')==='1'){
      const pat = patternSeeded();
      emit('groups:ai:pattern', pat);
    }

    requestAnimationFrame(tick);
  }

  // run
  init();

})();