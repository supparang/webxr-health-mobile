// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — STUB (Prediction/ML/DL-ready)
// ✅ Default: heuristic prediction (no ML yet)
// ✅ Research: deterministic-friendly (seeded runs supported by caller rng)
// ✅ Exposes hooks for:
//    - difficulty director (adaptive pace & ratios)
//    - coach micro-tips (rate-limited)
//    - pattern generator (spawn bias / streak control)
//
// Usage:
//   import { createAIHooks } from '../vr/ai-hooks.js';
//   const AI = createAIHooks({ game:'GoodJunkVR', mode:'play', rng });
//   AI.onEvent('hit', {...});  AI.getDifficulty(t);  AI.getTip(t);

'use strict';

export function createAIHooks(cfg = {}){
  const game = cfg.game || 'HHA';
  const mode = String(cfg.mode || 'play').toLowerCase();     // play | research | practice
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;

  // --- rate limit tips ---
  let lastTipAt = 0;
  const tipCooldownMs = Number(cfg.tipCooldownMs ?? 5500);

  // --- simple rolling stats ---
  const R = {
    hitGood:0, hitJunk:0, miss:0, combo:0,
    last10: [], // {t, type}
  };

  function pushEvent(type, t){
    R.last10.push({ type, t });
    if(R.last10.length > 10) R.last10.shift();
  }

  function onEvent(type, data = {}){
    const t = Number(data.t ?? performance.now());
    pushEvent(type, t);

    if(type === 'hitGood'){ R.hitGood++; R.combo++; }
    if(type === 'hitJunk'){ R.hitJunk++; R.combo = 0; }
    if(type === 'miss'){ R.miss++; R.combo = 0; }
    if(type === 'comboBreak'){ R.combo = 0; }
  }

  // --- Prediction (heuristic) ---
  // "predict" near-future risk: based on miss rate + junk hits
  function predictRisk(){
    const n = R.last10.length || 1;
    const bad = R.last10.filter(x => x.type === 'hitJunk' || x.type === 'miss').length;
    const risk = Math.min(1, bad / n);
    return risk; // 0..1
  }

  // --- Difficulty Director (heuristic) ---
  // Returns multipliers or targets for spawn pace / junk ratio
  function getDifficulty(tSec, base){
    // base = { spawnMs, pJunk, pGood, pStar, pShield }
    // research/practice => adaptive OFF
    if(mode !== 'play') return { ...base, tag:'fixed' };

    const risk = predictRisk(); // 0..1
    const ramp = Math.min(1, Math.max(0, (tSec - 8) / 40)); // grow after 8s

    // if risk high => slightly reduce junk (fair) + slightly increase shield/star
    const fairness = (risk > 0.55) ? 1 : 0;

    const spawnMs = Math.max(520, base.spawnMs - (ramp * 260) + (fairness ? 80 : 0));
    let pJunk   = Math.min(0.42, base.pJunk + ramp*0.14 - (fairness ? 0.06 : 0));
    let pGood   = Math.max(0.52, base.pGood - ramp*0.10 + (fairness ? 0.04 : 0));
    let pStar   = base.pStar + (fairness ? 0.01 : 0);
    let pShield = base.pShield + (fairness ? 0.01 : 0);

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    return { spawnMs, pGood, pJunk, pStar, pShield, tag: fairness ? 'assist' : 'ramp' };
  }

  // --- Coach micro-tips (rate-limited) ---
  function getTip(tSec){
    if(mode !== 'play') return null;
    const now = performance.now();
    if(now - lastTipAt < tipCooldownMs) return null;

    const risk = predictRisk();

    let msg = null;
    if(risk > 0.65) msg = 'ช้าลงนิดนึง 🎯 เล็ง “ของดี” ก่อน แล้วค่อยเก็บโบนัส ⭐/🛡️';
    else if(R.combo >= 6) msg = 'คอมโบสวยมาก! 🔥 รักษาจังหวะเดิม แล้วหลบของทอด/หวานให้ทัน';
    else if(tSec > 20 && R.miss === 0) msg = 'โคตรนิ่ง! 👏 ลองเพิ่มความเร็ว—เน้นแตะให้แม่น';
    else if(tSec > 12 && R.hitJunk > 0) msg = 'ทริค: ของเสียมักมาเป็นชุด—เล็ง “ของดี” ให้ไวที่สุด';

    if(msg){
      lastTipAt = now;
      return { msg, tag: `${game} Coach` };
    }
    return null;
  }

  // --- Pattern generator (stub) ---
  function nextPatternHint(){
    // reserved: can return 'goodStreak', 'junkWave', 'bonusDrop', etc.
    // deterministic: use rng()
    const r = rng();
    if(r < 0.12) return 'bonusDrop';
    if(r < 0.30) return 'junkWave';
    return 'mix';
  }

  return {
    onEvent,
    predictRisk,
    getDifficulty,
    getTip,
    nextPatternHint
  };
}