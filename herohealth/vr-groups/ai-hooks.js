// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — (Director + Coach micro-tips + Pattern generator)
// ✅ Disabled by default; enable with ?ai=1 (play only)
// ✅ Research mode: always disabled
// ✅ Deterministic suggestions via seed (no randomness unless provided)
// ✅ Emits: groups:ai:suggest (engine may consume), hha:coach (micro tips)

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const GroupsVR = root.GroupsVR = root.GroupsVR || {};
  const EV = (name, detail) => root.dispatchEvent(new CustomEvent(name, { detail }));

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // ---------- Deterministic RNG (xmur3 + mulberry32) ----------
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr){
    const seedFn = xmur3(String(seedStr||'seed'));
    return mulberry32(seedFn());
  }

  // ---------- Enable rules ----------
  function enabledFromParams(runMode){
    const run = String(runMode || qs('run','play') || 'play').toLowerCase();
    if (run === 'research') return false; // ✅ research always off
    const on = String(qs('ai','0')||'0');
    return (on === '1' || on === 'true');
  }

  // ---------- Director state ----------
  const S = {
    enabled:false,
    runMode:'play',
    seed:'0',
    rng: makeRng('0'),
    t0: performance.now(),
    lastTipAt: 0,
    tipCooldownMs: 5200,

    // live stats (lightweight)
    score:0, combo:0, misses:0,
    accuracy:0, grade:'C',
    lastJudge:'', // good/bad/miss/boss
    lastSwitchAt: 0,
    stormUrgent:false,

    // moving window
    nGood:0, nBad:0, nMiss:0,
    rtSamples:[],
    lastTickAt: 0,

    // suggestion outputs
    suggest: {
      // engine may consume these (optional)
      spawnRateMul: 1.0,
      sizeMul: 1.0,
      speedMul: 1.0,
      safeZoneMul: 1.0,
      aimAssistLockPx: null,
      patternKey: null,
      reason: ''
    }
  };

  // ---------- Micro-tip helper ----------
  function emitCoach(text, mood='neutral'){
    EV('hha:coach', { text, mood, src:'ai' });
  }

  function maybeTip(text, mood){
    const now = performance.now();
    if (now - S.lastTipAt < S.tipCooldownMs) return;
    S.lastTipAt = now;
    emitCoach(text, mood);
  }

  function computeFairness(){
    // fairness metric: penalize miss spikes, reward stable accuracy
    const total = Math.max(1, S.nGood + S.nBad + S.nMiss);
    const missRate = S.nMiss / total;
    const badRate  = S.nBad  / total;
    const goodRate = S.nGood / total;

    // quick proxy for "struggle"
    const struggle = clamp((missRate*1.1 + badRate*0.7) - (goodRate*0.2), 0, 1);
    // quick proxy for "bored"
    const bored = clamp((goodRate*0.9) - (missRate*1.2 + badRate*0.8), 0, 1);

    return { struggle, bored, missRate, badRate, goodRate };
  }

  function pickPattern(diff){
    // if patterns-groups.js exists: use it
    const P = GroupsVR.Patterns;
    if (P && typeof P.pick === 'function'){
      return P.pick({ seed:S.seed, diff, rng:S.rng });
    }
    // fallback deterministic keys
    const pool = ['mix','grid9','ring','zigzag','burst'];
    const idx = Math.floor(S.rng()*pool.length);
    return { key: pool[idx], meta:{fallback:true} };
  }

  function directorUpdate(){
    if (!S.enabled) return;

    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const { struggle, bored, missRate, badRate } = computeFairness();

    // Baseline per diff
    let baseSpawn = (diff==='easy') ? 0.95 : (diff==='hard' ? 1.08 : 1.0);
    let baseSize  = (diff==='easy') ? 1.10 : (diff==='hard' ? 0.94 : 1.0);
    let baseSpeed = (diff==='easy') ? 0.96 : (diff==='hard' ? 1.08 : 1.0);

    // Adaptive nudges (gentle, fair)
    // - Struggle: reduce speed/rate a bit, increase size, increase safezone
    // - Bored: increase rate/speed a bit, slightly reduce size
    const spawnAdj = clamp(baseSpawn + (bored*0.12) - (struggle*0.18), 0.75, 1.25);
    const sizeAdj  = clamp(baseSize  + (struggle*0.18) - (bored*0.10), 0.80, 1.30);
    const speedAdj = clamp(baseSpeed + (bored*0.10) - (struggle*0.15), 0.80, 1.25);
    const safeAdj  = clamp(1.0 + (struggle*0.18) - (bored*0.06), 0.85, 1.25);

    // aim-assist lock px (optional) : struggle -> larger lock
    let lockPx = null;
    const view = String(qs('view','mobile')||'mobile').toLowerCase();
    if (view === 'cvr'){
      lockPx = Math.round(92 + struggle*22 - bored*10); // around 82..115
      lockPx = clamp(lockPx, 78, 120);
    }

    // pattern selection (seeded)
    const picked = pickPattern(diff);

    // Reason text (for debug + explainable)
    let reason = '';
    if (struggle > 0.35) reason = `struggle↑ miss:${Math.round(missRate*100)}% bad:${Math.round(badRate*100)}%`;
    else if (bored > 0.35) reason = `bored↑ stable play`;
    else reason = `stable`;

    S.suggest = {
      spawnRateMul: spawnAdj,
      sizeMul: sizeAdj,
      speedMul: speedAdj,
      safeZoneMul: safeAdj,
      aimAssistLockPx: lockPx,
      patternKey: picked.key,
      reason
    };

    // emit suggestion (engine may consume)
    EV('groups:ai:suggest', {
      ...S.suggest,
      seed: S.seed,
      runMode: S.runMode,
      ts: Date.now()
    });

    // micro-tips (rate limited)
    if (struggle > 0.55){
      maybeTip('ลองโฟกัส “เป้าที่ถูกหมู่” ก่อนนะ แล้วค่อยเพิ่มความเร็ว 👍', 'sad');
    } else if (bored > 0.55){
      maybeTip('เก่งมาก! เดี๋ยวเพิ่มความท้าทายนิดนึงนะ 🔥', 'happy');
    } else if (S.stormUrgent){
      maybeTip('MINI ใกล้หมดเวลา! ยิงให้แม่นขึ้นอีกนิด ✨', 'fever');
    }
  }

  // ---------- Event taps (no engine changes needed) ----------
  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    S.score = Number(d.score||0);
    S.combo = Number(d.combo||0);
    S.misses= Number(d.misses||0);
  }, {passive:true});

  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    S.grade = String(d.grade||'C');
    S.accuracy = Number(d.accuracy||0);
  }, {passive:true});

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();
    S.lastJudge = kind;

    if (kind === 'good') S.nGood++;
    else if (kind === 'bad') S.nBad++;
    else if (kind === 'miss') S.nMiss++;

    // update more often when user is making decisions
    directorUpdate();
  }, {passive:true});

  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const left = Number(d.miniTimeLeftSec||0);
    S.stormUrgent = (left > 0 && left <= 3);
  }, {passive:true});

  // periodic update (slow)
  function loop(){
    if (S.enabled){
      const now = performance.now();
      if (now - S.lastTickAt > 1600){
        S.lastTickAt = now;
        directorUpdate();
      }
      // decay window slowly to keep fairness
      S.nGood = Math.max(0, Math.floor(S.nGood*0.92));
      S.nBad  = Math.max(0, Math.floor(S.nBad *0.92));
      S.nMiss = Math.max(0, Math.floor(S.nMiss*0.92));
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- Public API ----------
  GroupsVR.AIHooks = {
    attach(opts={}){
      const runMode = String(opts.runMode||qs('run','play')||'play').toLowerCase();
      S.runMode = runMode;
      S.seed = String(opts.seed || qs('seed', Date.now()) || Date.now());
      S.rng = makeRng(S.seed);

      S.enabled = !!(opts.enabled ?? enabledFromParams(runMode));
      if (!S.enabled) return false;

      // initial pattern + suggestion
      directorUpdate();
      emitCoach('AI พร้อมช่วยปรับความยากแบบยุติธรรม (เปิดอยู่) ✅', 'happy');
      return true;
    },
    isEnabled(){ return !!S.enabled; },
    getSuggest(){ return { ...S.suggest }; }
  };

})(window);