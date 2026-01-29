// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION SAFE (v2026-01-29)
// ✅ createAIHooks({game, mode, rng})
// ✅ Methods (all optional-safe):
//    - getDifficulty(tSec, base) -> {spawnMs,pGood,pJunk,pStar,pShield}
//    - getTip(tSec) -> {msg, tag}?  (rate-limited)
//    - onEvent(name, data) -> void
// ✅ Default: in research mode => returns base (no adaptation)
// ✅ Deterministic-friendly when rng is seeded

'use strict';

const clamp = (v, a, b)=>Math.max(a, Math.min(b, Number(v)||0));
const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

export function createAIHooks(opts = {}){
  const game = String(opts.game || 'HHA').trim();
  const mode = String(opts.mode || 'play').toLowerCase(); // play / research / practice
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  // ✅ In research mode: disable adaptation by default (fair + reproducible)
  const adaptiveEnabled = (mode === 'play');

  // --- rolling stats ---
  const S = {
    game, mode,
    // performance
    hitGood: 0,
    hitJunk: 0,
    miss: 0,         // includes expireGood
    streakGood: 0,
    lastEventAt: 0,
    // tip rate limit
    lastTipAt: 0,
    tipCooldownMs: 3000,
    // tiny memory window
    windowMs: 9000,
    events: [] // {t, name}
  };

  function pushEvent(name){
    const t = nowMs();
    S.events.push({ t, name });
    // prune
    const cut = t - S.windowMs;
    while(S.events.length && S.events[0].t < cut) S.events.shift();
  }

  function countsInWindow(){
    let g=0,j=0,m=0;
    for(const e of S.events){
      if(e.name==='hitGood') g++;
      else if(e.name==='hitJunk') j++;
      else if(e.name==='miss') m++;
    }
    return { g,j,m };
  }

  function getDifficulty(tSec, base){
    // Always return a fully-formed difficulty object
    const B = Object.assign({ spawnMs: 900, pGood: .70, pJunk: .26, pStar: .02, pShield: .02 }, base || {});
    if(!adaptiveEnabled) return { ...B };

    // window performance
    const W = countsInWindow();
    const total = (W.g + W.j + W.m) || 1;
    const badRate = (W.j + W.m) / total;   // 0..1
    const goodRate = W.g / total;          // 0..1

    // streak effect (skill)
    const streakBoost = clamp(S.streakGood / 10, 0, 1);

    // Difficulty scalar: higher => harder
    // - if player doing well => increase hardness
    // - if failing => reduce hardness
    let hard = 0.5;
    hard += (goodRate - 0.55) * 0.8; // reward skill
    hard -= (badRate - 0.35) * 0.9;  // protect if struggling
    hard += (streakBoost - 0.25) * 0.35;
    hard = clamp(hard, 0.10, 0.95);

    // spawnMs: faster when hard, slower when easy
    const spawnMs = clamp(
      B.spawnMs * (1.18 - hard * 0.55),
      520,
      1200
    );

    // probabilities: when hard -> more junk, less good, slightly more shields
    let pJunk  = B.pJunk  + (hard - 0.5) * 0.16;
    let pGood  = B.pGood  - (hard - 0.5) * 0.14;
    let pStar  = B.pStar  + (hard - 0.5) * 0.02;
    let pShield= B.pShield+ (0.5 - hard) * 0.04; // easier => more shield

    // clamp
    pGood   = clamp(pGood,   0.38, 0.82);
    pJunk   = clamp(pJunk,   0.16, 0.55);
    pStar   = clamp(pStar,   0.01, 0.06);
    pShield = clamp(pShield, 0.01, 0.08);

    // normalize (sum=1)
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  function getTip(tSec){
    if(!adaptiveEnabled) return null;

    const t = nowMs();
    if(t - S.lastTipAt < S.tipCooldownMs) return null;

    const W = countsInWindow();

    // Simple, explainable micro-tips (เด็ก ป.5 อ่านง่าย)
    let msg = '';
    if(W.m >= 2){
      msg = 'ลอง “โฟกัสของดี” ก่อนนะ 👀 ของดีพลาดแล้วจะเป็น MISS';
    }else if(W.j >= 2){
      msg = 'ระวังของทอด/หวาน! 🍟🍩 ถ้าเห็นให้เลี่ยงหรือใช้ 🛡️';
    }else if(S.streakGood >= 6){
      msg = 'คอมโบกำลังมา! 🔥 รักษาจังหวะแล้วจะได้คะแนนเพิ่ม';
    }else if(tSec > 20 && (W.g===0 && W.j===0 && W.m===0)){
      msg = 'ถ้าเล่นโหมดแว่น ใช้เป้าเล็งกลางจอแล้วยิงได้เลย 🎯';
    }

    if(!msg) return null;

    S.lastTipAt = t;
    return { msg, tag: 'Coach' };
  }

  function onEvent(name, data){
    // no-throw safe
    try{
      const n = String(name || '').trim();
      if(!n) return;

      pushEvent(n);
      S.lastEventAt = nowMs();

      if(n === 'hitGood'){
        S.hitGood++;
        S.streakGood++;
      }else if(n === 'hitJunk'){
        S.hitJunk++;
        S.streakGood = 0;
      }else if(n === 'miss'){
        S.miss++;
        S.streakGood = 0;
      }

      // (reserved) future ML/DL hooks:
      // - send features to predictor
      // - update bandit policy
      void(data);
    }catch(_){}
  }

  return {
    enabled: adaptiveEnabled,
    getDifficulty,
    getTip,
    onEvent
  };
}