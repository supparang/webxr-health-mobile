// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION SAFE (v1)
// ✅ Export: createAIHooks({game, mode, rng})
// ✅ Always returns functions: getDifficulty(), getTip(), onEvent()
// ✅ mode=play => adaptive ON (rule-based, deterministic-ish via rng)
// ✅ mode=study/research => adaptive OFF (returns base unchanged)
// ✅ NEVER throws (guards all calls)

'use strict';

export function createAIHooks(cfg = {}){
  const game = String(cfg.game || 'HHA').trim() || 'HHA';
  const mode = String(cfg.mode || 'play').toLowerCase();
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;

  // research/study => keep deterministic & no adaptation
  const adaptive = (mode === 'play');

  const S = {
    // rolling counters
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    // timestamps for pacing
    lastEventAt: 0,
    lastTipAt: 0,
    // simple difficulty scalar 0..1
    d: 0.0,
    // smoothed performance
    perf: 0.5,   // 0..1
    // anti-spam
    tipCooldownMs: 6500
  };

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const lerp  = (a,b,t)=>a + (b-a)*t;

  function updatePerf(){
    // perf higher when more good hits, lower when junk/miss
    const good = S.hitGood;
    const bad  = S.hitJunk + S.miss;
    const total = good + bad;

    let p = 0.5;
    if(total > 0){
      // weighted: junk+miss hurt a bit more
      p = clamp((good) / (good + 1.25*bad), 0, 1);
    }
    // smooth
    S.perf = lerp(S.perf, p, 0.12);

    // convert perf into difficulty scalar:
    // if perf high -> increase difficulty; if low -> ease off
    const targetD = clamp((S.perf - 0.45) / 0.35, 0, 1); // perf 0.45..0.80 -> d 0..1
    S.d = lerp(S.d, targetD, 0.10);
  }

  function onEvent(name, data){
    try{
      if(!adaptive) return;
      const t = nowMs();
      S.lastEventAt = t;

      const ev = String(name||'').toLowerCase();
      if(ev === 'hitgood') S.hitGood++;
      else if(ev === 'hitjunk') S.hitJunk++;
      else if(ev === 'miss') S.miss++;

      updatePerf();
    }catch(_){}
  }

  function getDifficulty(playedSec, base){
    // always safe
    try{
      const B = base || { spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 };
      if(!adaptive){
        return { ...B };
      }

      // also ramp up slightly with time played (makes it exciting)
      const timeRamp = clamp((Number(playedSec)||0) / 70, 0, 1); // 0..1 ~70s
      const d = clamp(S.d*0.75 + timeRamp*0.25, 0, 1);

      // spawn speed: faster when d higher
      const spawnMs = clamp(
        Math.round(lerp(B.spawnMs, Math.max(520, B.spawnMs - 320), d)),
        420, 1300
      );

      // probabilities: more junk when d higher (but keep fair)
      let pJunk = clamp(B.pJunk + d*0.14, 0.16, 0.56);
      let pGood = clamp(B.pGood - d*0.12, 0.35, 0.78);

      // keep bonuses meaningful: when player struggles (perf low) => more shield/star
      const struggle = clamp(0.55 - S.perf, 0, 0.55) / 0.55; // 0..1
      let pShield = clamp(B.pShield + struggle*0.04 + (rng()*0.005), 0.01, 0.08);
      let pStar   = clamp(B.pStar   + struggle*0.03 + (rng()*0.005), 0.01, 0.07);

      // normalize
      let sum = pGood + pJunk + pStar + pShield;
      if(sum <= 0) sum = 1;
      pGood/=sum; pJunk/=sum; pStar/=sum; pShield/=sum;

      return { spawnMs, pGood, pJunk, pStar, pShield };
    }catch(_){
      return { ...(base||{}) };
    }
  }

  function getTip(playedSec){
    try{
      if(!adaptive) return null;
      const t = nowMs();
      if(t - S.lastTipAt < S.tipCooldownMs) return null;

      // trigger tip occasionally based on struggle or boss-like high d
      const struggle = (S.perf < 0.45) || (S.miss >= 3);
      const spicy    = (S.d > 0.65);

      // small random gate
      const gate = rng();
      if(!struggle && !spicy && gate < 0.70) return null;

      S.lastTipAt = t;

      let msg = '';
      if(struggle){
        msg = 'ทิป: โฟกัส “ของดี” ก่อน แล้วค่อยหลบของเสีย 👀';
      }else if(spicy){
        msg = 'ทิป: ตอนนี้เกมเริ่มโหดขึ้น—คุมคอมโบให้ได้ แล้วจะคะแนนพุ่ง! 🔥';
      }else{
        msg = 'ทิป: ยิง/แตะให้เร็ว แต่ต้องแม่น—อย่าเผลอโดนของเสีย 😊';
      }

      return { msg, tag: `${game} AI` };
    }catch(_){
      return null;
    }
  }

  // ✅ Always return a complete interface
  return Object.freeze({
    onEvent,
    getDifficulty,
    getTip
  });
}