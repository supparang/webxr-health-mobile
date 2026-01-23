// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR — AI Hooks (Play only; disabled in research/practice by caller)
// ✅ AI Prediction: risk-of-miss estimate (1Hz) + explainable coach tips (rate-limited)
// ✅ ML Adaptive DD: adjusts spawnMul / wrongDelta / junkDelta / sizeMul toward target challenge band
// ✅ Deep learning hook: window.HHA_AI_MODEL.predict(features) optional (fallback to heuristic)
// Emits: hha:ai (risk, dd, features) for logging/analytics

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const NS = WIN.GroupsVR = WIN.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
  }

  // deterministic RNG by seed for any discrete AI decisions (play only)
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(u32){
    let s=(u32>>>0)||1;
    return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296);
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  // -------- Heuristic risk model (fallback) --------
  // Output: 0..1 risk (higher = more likely to miss soon)
  function heuristicRisk(f){
    // f: {acc, missRate, combo, comboDrop, storm, mini, left, tempo, pressure}
    // keep it smooth & explainable
    const acc = clamp(f.acc, 0, 100);
    const missRate = clamp(f.missRate, 0, 1);        // misses per second (smoothed)
    const combo = clamp(f.combo, 0, 30);
    const comboDrop = clamp(f.comboDrop, 0, 1);      // 1 if just dropped
    const storm = f.storm ? 1 : 0;
    const mini  = f.mini  ? 1 : 0;
    const pressure = clamp(f.pressure||0, 0, 3) / 3; // 0..1
    const tempo = clamp(f.tempo||0, 0, 3) / 3;       // 0..1

    // risk pieces
    const lowAcc = clamp((80 - acc)/40, 0, 1);       // below 80 -> rising
    const miss = clamp(missRate*2.4, 0, 1);          // 0.4 miss/s -> near max
    const noCombo = clamp((4 - combo)/4, 0, 1);

    // weighted sum then squash
    let v =
      0.40*lowAcc +
      0.28*miss +
      0.14*noCombo +
      0.10*comboDrop +
      0.08*(storm?1:0) +
      0.06*(mini?1:0) +
      0.08*pressure +
      0.06*tempo;

    v = clamp(v, 0, 1);
    return v;
  }

  // -------- Explainable coach message --------
  function chooseTip(f, risk){
    // return {text,mood} or null
    if (risk < 0.58) return null;

    // priority tips
    if (f.storm) return { text:'พายุมาแล้ว! ช้าลงนิด เล็งให้ตรงหมู่ก่อนยิง 🌪️', mood:'fever' };
    if (f.mini)  return { text:'MINI อยู่! โฟกัส “ถูกติดต่อกัน” อย่ายิงมั่ว ⚡', mood:'neutral' };
    if (f.acc < 65) return { text:'ความแม่นต่ำแล้วนะ—ดูชื่อหมู่ใน GOAL ก่อนยิง 👀', mood:'sad' };
    if (f.comboDrop) return { text:'คอมโบหลุด! หายใจลึก ๆ แล้วค่อยแตะยิง 🎯', mood:'neutral' };
    if (f.missRate > 0.18) return { text:'เริ่มพลาดถี่แล้ว—หยุดยิงมั่ว 1 วิ แล้วค่อยกลับมา ✅', mood:'sad' };
    return { text:'โหมดกดดัน! เล็งกลางวงให้ชัวร์ แล้วค่อยยิง 🔥', mood:'fever' };
  }

  // -------- ML Adaptive DD controller --------
  // Goal band (for Grade 5): acc 72–88, missRate 0.05–0.14, combo stable
  function computeDD(f){
    // outputs: spawnMul (0.80..1.20), wrongDelta (-0.06..+0.10), junkDelta (-0.05..+0.08), sizeMul (0.92..1.10)
    // where "spawnMul < 1" = faster spawns, "> 1" = slower spawns

    // errors
    const acc = clamp(f.acc, 0, 100);
    const missRate = clamp(f.missRate, 0, 1);

    // challenge score: + means too easy, - means too hard
    // (high acc & low miss => too easy)
    let easy = 0;
    if (acc > 88) easy += (acc - 88) / 20;          // up to +0.6
    if (missRate < 0.06) easy += (0.06 - missRate) / 0.06; // up to +1
    easy = clamp(easy, 0, 1.2);

    let hard = 0;
    if (acc < 72) hard += (72 - acc) / 30;          // up to +1
    if (missRate > 0.14) hard += (missRate - 0.14) / 0.14; // up to +1
    hard = clamp(hard, 0, 1.2);

    // base adjustments
    let spawnMul = 1.0;
    let wrongDelta = 0.0;
    let junkDelta  = 0.0;
    let sizeMul    = 1.0;

    if (easy > hard){
      const k = clamp((easy - hard), 0, 1);
      // make harder: faster spawn, slightly more wrong/junk, slightly smaller
      spawnMul = 1.0 - 0.10*k;        // down to 0.90
      wrongDelta = +0.03*k;           // up to +0.03
      junkDelta  = +0.02*k;           // up to +0.02
      sizeMul    = 1.0 - 0.04*k;      // down to 0.96
    } else if (hard > easy){
      const k = clamp((hard - easy), 0, 1);
      // make easier: slower spawn, less wrong/junk, slightly bigger
      spawnMul = 1.0 + 0.14*k;        // up to 1.14
      wrongDelta = -0.04*k;           // down to -0.04
      junkDelta  = -0.03*k;           // down to -0.03
      sizeMul    = 1.0 + 0.06*k;      // up to 1.06
    }

    // extra: during storm, don't over-tune too aggressively
    if (f.storm){
      spawnMul = 1.0 + (spawnMul-1.0)*0.55;
      wrongDelta *= 0.55;
      junkDelta  *= 0.55;
      sizeMul    = 1.0 + (sizeMul-1.0)*0.65;
    }

    // clamp safe ranges
    spawnMul  = clamp(spawnMul, 0.80, 1.20);
    wrongDelta= clamp(wrongDelta, -0.06, 0.10);
    junkDelta = clamp(junkDelta,  -0.05, 0.08);
    sizeMul   = clamp(sizeMul, 0.92, 1.10);

    return { spawnMul, wrongDelta, junkDelta, sizeMul };
  }

  // -------- Feature extraction (from events) --------
  const S = {
    enabled:false,
    runMode:'play',
    seed:'',
    rng: ()=>Math.random(),

    lastTick:0,
    lastCoachAt:0,

    score:0,
    combo:0,
    misses:0,
    acc:0,
    pressure:0,

    // derived
    missRateEMA:0,       // misses/sec smoothed
    lastMisses:0,
    comboDrop:0,
    storm:false,
    mini:false,
    left:0,
    tempoEMA:0,          // judges/sec smoothed
    _judgeCount:0,
    _judgeCountPrev:0,

    dd:{ spawnMul:1, wrongDelta:0, junkDelta:0, sizeMul:1 }
  };

  // capture events
  WIN.addEventListener('hha:score', (ev)=>{
    const d=ev.detail||{};
    const prevCombo = S.combo|0;
    S.score = Number(d.score||0);
    S.combo = Number(d.combo||0);
    S.misses= Number(d.misses||0);
    S.comboDrop = (prevCombo>=3 && S.combo===0) ? 1 : 0;
  }, {passive:true});

  WIN.addEventListener('hha:rank', (ev)=>{
    const d=ev.detail||{};
    S.acc = Number(d.accuracy||0);
  }, {passive:true});

  WIN.addEventListener('groups:progress', (ev)=>{
    const d=ev.detail||{};
    if (d && d.kind==='pressure') S.pressure = Number(d.level||0);
    if (d && d.kind==='storm_on') S.storm = true;
    if (d && d.kind==='storm_off') S.storm = false;
  }, {passive:true});

  WIN.addEventListener('quest:update', (ev)=>{
    const d=ev.detail||{};
    // mini is active if miniTimeLeftSec>0 or miniTitle indicates MINI
    const t = Number(d.miniTimeLeftSec||0);
    S.mini = (t>0) || String(d.miniTitle||'').toUpperCase().includes('MINI');
  }, {passive:true});

  WIN.addEventListener('hha:time', (ev)=>{
    const d=ev.detail||{};
    S.left = Number(d.left||0);
  }, {passive:true});

  WIN.addEventListener('hha:judge', ()=>{
    S._judgeCount++;
  }, {passive:true});

  function buildFeatures(){
    // miss rate EMA
    const m = S.misses|0;
    const dm = Math.max(0, m - (S.lastMisses|0));
    S.lastMisses = m;

    // 1Hz tick -> misses/sec approx = dm
    S.missRateEMA = 0.80*S.missRateEMA + 0.20*clamp(dm, 0, 3);

    // tempo (judge events per sec)
    const dj = Math.max(0, S._judgeCount - (S._judgeCountPrev|0));
    S._judgeCountPrev = S._judgeCount;
    S.tempoEMA = 0.82*S.tempoEMA + 0.18*clamp(dj, 0, 3);

    return {
      ts: Date.now(),
      left: S.left|0,
      score: S.score|0,
      combo: S.combo|0,
      comboDrop: S.comboDrop|0,
      misses: S.misses|0,
      acc: clamp(S.acc,0,100),
      missRate: clamp(S.missRateEMA/1.0, 0, 1), // misses/sec
      storm: !!S.storm,
      mini: !!S.mini,
      pressure: S.pressure|0,
      tempo: clamp(S.tempoEMA, 0, 3)
    };
  }

  async function predictRisk(features){
    // Deep Learning hook (optional)
    const M = WIN.HHA_AI_MODEL;
    if (M && typeof M.predict === 'function'){
      try{
        const out = await M.predict(features); // may return {risk, explain, dd}
        if (out && typeof out.risk === 'number'){
          return clamp(out.risk, 0, 1);
        }
      }catch(_){}
    }
    return heuristicRisk(features);
  }

  function maybeCoach(features, risk){
    if (!S.enabled) return;

    const t = now();
    if (t - S.lastCoachAt < 4200) return; // rate-limit ~4.2s
    const tip = chooseTip(features, risk);
    if (!tip) return;

    S.lastCoachAt = t;
    emit('hha:coach', { text: tip.text, mood: tip.mood });

    // small UX hint: tag as AI
    emit('hha:ai', { kind:'tip', risk, tip });
  }

  function applyDD(features, risk){
    if (!S.enabled) return;

    // risk high => ease a bit, risk low & very accurate => harden a bit
    let dd = computeDD(features);

    // subtle risk-based bias (keeps kids in flow)
    if (risk >= 0.78){
      dd.spawnMul  = clamp(dd.spawnMul + 0.08, 0.80, 1.20); // slow slightly
      dd.wrongDelta= clamp(dd.wrongDelta - 0.02, -0.06, 0.10);
      dd.junkDelta = clamp(dd.junkDelta  - 0.02, -0.05, 0.08);
      dd.sizeMul   = clamp(dd.sizeMul   + 0.04, 0.92, 1.10);
    } else if (risk <= 0.28 && features.acc >= 90 && features.missRate <= 0.05){
      dd.spawnMul  = clamp(dd.spawnMul - 0.06, 0.80, 1.20); // faster slightly
      dd.wrongDelta= clamp(dd.wrongDelta + 0.02, -0.06, 0.10);
      dd.junkDelta = clamp(dd.junkDelta  + 0.02, -0.05, 0.08);
      dd.sizeMul   = clamp(dd.sizeMul   - 0.03, 0.92, 1.10);
    }

    S.dd = dd;

    // Send directives to engine (only if engine exposes setter)
    try{
      const E = NS.GameEngine;
      if (E && typeof E.setAIDirective === 'function'){
        E.setAIDirective({
          enabled:true,
          spawnMul: dd.spawnMul,
          wrongDelta: dd.wrongDelta,
          junkDelta: dd.junkDelta,
          sizeMul: dd.sizeMul
        });
      }
    }catch(_){}

    emit('hha:ai', { kind:'dd', risk, dd, features });
  }

  // 1Hz loop
  let timer = 0;
  function startLoop(){
    if (timer) return;
    timer = setInterval(async ()=>{
      if (!S.enabled) return;

      const features = buildFeatures();
      const risk = await predictRisk(features);

      maybeCoach(features, risk);
      applyDD(features, risk);

      // expose features for logging/training (Deep learning dataset)
      emit('hha:ai', { kind:'features', risk, features });
    }, 1000);
  }

  // Public API
  NS.AIHooks = {
    attach(opts){
      opts = opts || {};
      const runMode = String(opts.runMode||'play').toLowerCase();
      const enabled = !!opts.enabled && (runMode === 'play'); // safety

      S.runMode = runMode;
      S.enabled = enabled;
      S.seed = String(opts.seed||'');

      // deterministic rng (if you need discrete choices later)
      S.rng = makeRng(hashSeed((S.seed||String(Date.now())) + '::aihooks'));

      // reset dynamics
      S.lastCoachAt = 0;
      S.missRateEMA = 0;
      S.tempoEMA = 0;
      S._judgeCount = 0;
      S._judgeCountPrev = 0;

      // tell engine AI is off/on
      try{
        const E = NS.GameEngine;
        if (E && typeof E.setAIDirective === 'function'){
          E.setAIDirective({ enabled, spawnMul:1, wrongDelta:0, junkDelta:0, sizeMul:1 });
        }
      }catch(_){}

      if (enabled) startLoop();
      emit('hha:ai', { kind:'attach', enabled, runMode, seed:S.seed });
    }
  };

})();