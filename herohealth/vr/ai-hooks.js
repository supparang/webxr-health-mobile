// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — SAFE PRODUCTION
// ✅ Always provides: getDifficulty(), getTip(), onEvent()
// ✅ Disabled by default for non-play modes (research/practice)
// ✅ Deterministic-friendly: uses provided rng if any
// Notes: This is NOT "real ML" - it's a safe adaptive director + explainable tips.

'use strict';

const WIN = window;

const clamp = (v, a, b)=>Math.max(a, Math.min(b, Number(v)||0));
const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

export function createAIHooks(opts = {}){
  const game = String(opts.game || 'HHA').slice(0, 40);
  const mode = String(opts.mode || 'play').toLowerCase();
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  const enabled = (mode === 'play'); // keep OFF for research/practice by design

  // --- rolling stats ---
  const S = {
    enabled,
    game,
    mode,
    // recent window (EMA)
    emaAcc: 0.72,     // "good hit" tendency
    emaMist: 0.10,    // mistakes tendency
    emaSpeed: 0.50,   // pace proxy
    lastEventAt: 0,

    // counters
    hitGood: 0,
    hitJunk: 0,
    miss: 0,

    // tips
    lastTipAt: 0,
    tipCooldownMs: 6500,
    lastTipKey: ''
  };

  function onEvent(type, payload = {}){
    if(!S.enabled) return;

    const t = Number(payload.t ?? nowMs());
    if(t < S.lastEventAt) S.lastEventAt = t;
    S.lastEventAt = t;

    // update simple EMAs
    // accuracy proxy: hitGood is good, hitJunk/miss are bad
    if(type === 'hitGood'){
      S.hitGood++;
      S.emaAcc = S.emaAcc*0.90 + 0.10*(1.0);
      S.emaMist = S.emaMist*0.92 + 0.08*(0.0);
      S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.70);
    }else if(type === 'hitJunk'){
      S.hitJunk++;
      S.emaAcc = S.emaAcc*0.90 + 0.10*(0.0);
      S.emaMist = S.emaMist*0.92 + 0.08*(1.0);
      S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.55);
    }else if(type === 'miss'){
      S.miss++;
      S.emaAcc = S.emaAcc*0.92 + 0.08*(0.0);
      S.emaMist = S.emaMist*0.90 + 0.10*(1.0);
      S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.40);
    }else if(type === 'shoot'){
      // pace proxy (frequent shooting => higher speed)
      S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.85);
    }
  }

  // --- Adaptive Difficulty Director ---
  // returns adjusted {spawnMs,pGood,pJunk,pStar,pShield}
  function getDifficulty(playedSec, base){
    const b = Object.assign({}, base || {});
    if(!S.enabled) return b;

    const t = clamp(playedSec, 0, 9999);

    // compute "stress" from mistakes and pace
    const mist = clamp(S.emaMist, 0, 1);
    const acc  = clamp(S.emaAcc, 0, 1);
    const spd  = clamp(S.emaSpeed, 0, 1);

    // target: keep player in "flow"
    // if too many mistakes -> ease a bit (slower spawn, less junk)
    // if too accurate -> increase challenge (faster spawn, more junk)
    let k = 0;
    k += (acc - 0.72) * 0.90;   // good performance pushes harder
    k -= (mist - 0.12) * 1.10;  // mistakes pull easier
    k += (spd - 0.55) * 0.35;   // fast pace can handle slightly more

    // small deterministic wobble (optional) to avoid monotony
    const wob = (rng() - 0.5) * 0.06;
    k = clamp(k + wob, -0.35, 0.35);

    // apply
    const spawnMin = 520;
    const spawnMax = 1100;

    const spawnMs = clamp((b.spawnMs || 900) * (1 - k*0.22), spawnMin, spawnMax);

    // adjust distribution
    let pJunk  = clamp((b.pJunk  ?? 0.26) + k*0.07, 0.18, 0.55);
    let pGood  = clamp((b.pGood  ?? 0.70) - k*0.07, 0.35, 0.78);
    let pStar  = clamp((b.pStar  ?? 0.02) + (-k)*0.01, 0.01, 0.06);
    let pShield= clamp((b.pShield?? 0.02) + (-k)*0.02, 0.01, 0.10);

    // mild ramp by time (later => slightly harder, but capped)
    if(t > 10){
      const r = clamp((t-10)/60, 0, 1); // up to +1
      pJunk = clamp(pJunk + r*0.03, 0.18, 0.60);
      pGood = clamp(pGood - r*0.03, 0.30, 0.78);
    }

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  // --- Explainable micro-tips ---
  function getTip(playedSec){
    if(!S.enabled) return null;

    const t = nowMs();
    if(t - S.lastTipAt < S.tipCooldownMs) return null;

    const mist = clamp(S.emaMist, 0, 1);
    const acc  = clamp(S.emaAcc, 0, 1);

    let key = '';
    let msg = '';

    if(mist > 0.22){
      key = 'mist';
      msg = 'โฟกัส “ของดี” ก่อนนะ 👀 ถ้าเห็นของเสียใกล้จุดเล็งให้ชะลอ 0.5 วิแล้วค่อยยิง';
    }else if(acc > 0.86){
      key = 'acc';
      msg = 'เก่งมาก! ต่อไปลองคุมคอมโบให้ยาวขึ้น 🔥 อย่ารีบยิงถ้ายังไม่ชัวร์ว่าเป็นของดี';
    }else{
      key = 'flow';
      msg = 'เคล็ดลับ: เล็งกลางจอแล้วค่อยยิง 🎯 ถ้าพลาดบ่อยให้ใช้ SHIELD ช่วยกัน MISS';
    }

    // avoid repeating same tip
    if(key === S.lastTipKey && (t - S.lastTipAt < S.tipCooldownMs*1.6)) return null;

    S.lastTipAt = t;
    S.lastTipKey = key;

    return { msg, tag: `${game} AI` };
  }

  return {
    enabled: S.enabled,
    onEvent,
    getDifficulty,
    getTip
  };
}