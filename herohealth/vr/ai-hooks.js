// === /herohealth/vr/ai-hooks.js ===
// AI Hooks — PRODUCTION SAFE (HeroHealth Standard)
// ✅ Difficulty Director (lightweight + fair)
// ✅ Coach micro-tips (rate-limited, explainable)
// ✅ Telemetry for Prediction features (rolling stats)
// ✅ Deterministic-friendly: in research/practice => return null / no-op
'use strict';

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const nowMs = ()=> (performance?.now ? performance.now() : Date.now());

export function createAIHooks(cfg = {}){
  const game = String(cfg.game || 'Game');
  const mode = String(cfg.mode || 'play').toLowerCase(); // play | research | practice
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;

  const isResearch = (mode === 'research' || mode === 'practice');

  // -----------------------------
  // Telemetry (Prediction features)
  // -----------------------------
  const T = {
    t0: nowMs(),
    lastTipAt: 0,
    tipCooldownMs: 2400,

    // rolling counts
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    expireGood: 0,

    // streak
    combo: 0,
    comboMax: 0,

    // recent window (for "prediction")
    windowMs: 12000,
    recent: [], // [{t, type}]
  };

  function pushRecent(type){
    const t = nowMs();
    T.recent.push({ t, type });
    const cut = t - T.windowMs;
    while(T.recent.length && T.recent[0].t < cut) T.recent.shift();
  }

  function recentRate(type){
    if(!T.recent.length) return 0;
    const n = T.recent.filter(x=>x.type===type).length;
    return n / T.recent.length;
  }

  // -----------------------------
  // Difficulty Director (fair)
  // -----------------------------
  function getDifficulty(playedSec, base){
    if(isResearch) return null; // IMPORTANT: do not adapt in research/practice

    const b = Object.assign({}, base || {});
    // Fallback defaults
    b.spawnMs = Number(b.spawnMs)||900;
    b.pGood   = Number(b.pGood)||0.70;
    b.pJunk   = Number(b.pJunk)||0.26;
    b.pStar   = Number(b.pStar)||0.02;
    b.pShield = Number(b.pShield)||0.02;

    // --- prediction signals (simple but meaningful)
    const missRateRecent  = recentRate('miss');      // 0..1
    const junkRateRecent  = recentRate('hitJunk');   // 0..1
    const goodRateRecent  = recentRate('hitGood');   // 0..1

    // "stress" ~ mistakes and misses in recent window
    const stress = clamp( (missRateRecent*1.2 + junkRateRecent*0.9) - goodRateRecent*0.4, 0, 1 );

    // "skill" ~ combo + good consistency
    const skill = clamp( (T.comboMax/10)*0.6 + goodRateRecent*0.5 - missRateRecent*0.4, 0, 1 );

    // Director rule:
    // - If stress high => ease slightly (fair)
    // - If skill high & stress low => ramp (challenge)
    let spawnMs = b.spawnMs;
    spawnMs *= (1.0 + stress*0.22);   // ease -> slower spawns
    spawnMs *= (1.0 - skill*0.18);    // ramp -> faster spawns
    spawnMs = clamp(spawnMs, 520, 1100);

    // probabilities: adjust gently (do not swing wildly)
    let pGood = b.pGood;
    let pJunk = b.pJunk;
    let pStar = b.pStar;
    let pShield = b.pShield;

    // If player struggling => more good + more shield, slightly less junk
    pGood   += stress*0.06;
    pShield += stress*0.02;
    pJunk   -= stress*0.06;

    // If player cruising => more junk + slightly fewer helpers
    pJunk   += skill*0.06;
    pGood   -= skill*0.05;
    pStar   -= skill*0.01;
    pShield -= skill*0.01;

    // clamp
    pGood   = clamp(pGood,   0.40, 0.86);
    pJunk   = clamp(pJunk,   0.10, 0.55);
    pStar   = clamp(pStar,   0.00, 0.05);
    pShield = clamp(pShield, 0.00, 0.07);

    return { spawnMs, pGood, pJunk, pStar, pShield, _signals:{ stress, skill } };
  }

  // -----------------------------
  // Coach micro-tips (explainable)
  // -----------------------------
  function getTip(playedSec){
    if(isResearch) return null;

    const t = nowMs();
    if(t - T.lastTipAt < T.tipCooldownMs) return null;

    // generate explainable tips from telemetry
    const missRate = recentRate('miss');
    const junkRate = recentRate('hitJunk');
    const goodRate = recentRate('hitGood');

    let msg = null;

    if(missRate > 0.28){
      msg = 'ลอง “ชะลอมือ” นิดนึง 🎯 เล็งให้โดนของดีเป็นหลัก (MISS สูง)';
    }else if(junkRate > 0.26){
      msg = 'ระวังของทอด/หวาน 🍟🍩 ถ้าเห็นหลายอันพร้อมกันให้เก็บ “ของดี” ก่อน';
    }else if(goodRate > 0.65 && T.comboMax >= 6){
      msg = 'สุดยอดคอมโบ! 🔥 ลองรักษาจังหวะเดิม แล้วหลบของเสียให้เนียนขึ้น';
    }else if(playedSec > 8 && T.comboMax < 3){
      msg = 'ทริค: เก็บของดีติดกัน 3–5 ชิ้นก่อน จะทำให้คะแนนพุ่งเร็วมาก ✅';
    }

    if(!msg) return null;

    T.lastTipAt = t;
    return { msg, tag: `${game} Coach` };
  }

  // -----------------------------
  // Event intake (for prediction)
  // -----------------------------
  function onEvent(name, payload = {}){
    // allow no-op in research for purity (still ok to log externally)
    if(isResearch) return;

    const n = String(name||'').toLowerCase();

    if(n === 'hitgood'){
      T.hitGood++;
      T.combo++;
      T.comboMax = Math.max(T.comboMax, T.combo);
      pushRecent('hitGood');
    }else if(n === 'hitjunk'){
      T.hitJunk++;
      T.combo = 0;
      pushRecent('hitJunk');
    }else if(n === 'miss'){
      T.miss++;
      T.combo = 0;
      pushRecent('miss');
    }else if(n === 'expiregood'){
      T.expireGood++;
      T.combo = 0;
      pushRecent('miss');
    }
  }

  return {
    // required by your engine calls:
    getDifficulty,
    getTip,
    onEvent,

    // optional debugging/analysis:
    getSignals: ()=>({
      hitGood:T.hitGood, hitJunk:T.hitJunk, miss:T.miss,
      comboMax:T.comboMax,
      recentCount:T.recent.length,
      missRateRecent: recentRate('miss'),
      junkRateRecent: recentRate('hitJunk')
    })
  };
}