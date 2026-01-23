// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION
// ✅ Emit feature frames: hha:ai
// ✅ Prediction helper: predictWinHeuristic
// ✅ Difficulty director helper (tier 0..3) with fairness guards
// ✅ Coach rate-limit helper
// Works with any game state shape (pass your getters)

'use strict';

const WIN = window;

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name,{ detail })); }catch{}
}

export function makeCoachRateLimiter({ cooldownMs = 3200 } = {}){
  let lastAt = 0;
  return function canSpeak(nowMs){
    if(nowMs - lastAt < cooldownMs) return false;
    lastAt = nowMs;
    return true;
  };
}

export function defaultDirectorConfig(){
  return {
    enabled: true,
    tier: 1,                 // 0..3
    evalEveryMs: 2000,
    holdMs: 4500,
    lastEvalAt: 0,
    lastChangeAt: 0,
    minTier: 0,
    maxTier: 3
  };
}

/**
 * Fair, smooth tier update.
 * Provide signals:
 *  - acc (0..1)
 *  - miss (int)
 *  - comboMax (int)
 *  - uniqueProgress (0..5 or 0..something)
 *  - tLeft (sec)
 */
export function directorStep(dir, signals, nowMs){
  if(!dir?.enabled) return { changed:false, tier: dir?.tier ?? 1, reason:'disabled' };

  const d = dir;
  const {
    acc = 1,
    miss = 0,
    comboMax = 0,
    uniqueProgress = 0,
    tLeft = 999
  } = signals || {};

  if(nowMs - d.lastEvalAt < d.evalEveryMs) return { changed:false, tier:d.tier, reason:'cooldown-eval' };
  d.lastEvalAt = nowMs;

  if(nowMs - d.lastChangeAt < d.holdMs) return { changed:false, tier:d.tier, reason:'hold' };

  const doingGreat = (acc >= 0.86 && comboMax >= 7 && miss <= 3 && uniqueProgress >= 2);
  const struggling = (acc <= 0.66 || miss >= 6);

  let next = d.tier;

  if(doingGreat && tLeft > 18) next = Math.min(d.maxTier, next + 1);
  else if(struggling)          next = Math.max(d.minTier, next - 1);

  if(next !== d.tier){
    d.tier = next;
    d.lastChangeAt = nowMs;
    return { changed:true, tier:next, reason: doingGreat ? 'doingGreat' : 'struggling' };
  }
  return { changed:false, tier:d.tier, reason:'stable' };
}

/**
 * Prediction heuristic (game-agnostic):
 * - pGoal: progress speed vs remaining need
 * - pAcc : current acc vs threshold (0.8)
 * You pass: uniqueNow, needTotal, timeLeft, tSpentSec, acc
 */
export function predictWinHeuristic({
  uniqueNow = 0,
  needTotal = 5,
  timeLeft = 60,
  tSpentSec = 1,
  acc = 1,
  accTarget = 0.80
} = {}){
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  const need = Math.max(0, needTotal - uniqueNow);
  const rate = uniqueNow / Math.max(1, tSpentSec);     // units/sec (rough)
  const expAdd = rate * Math.max(0, timeLeft);

  let pGoal = 0.15;
  if(need <= 0) pGoal = 0.98;
  else{
    const margin = expAdd - need;
    pGoal = clamp(0.5 + margin * 0.22, 0.05, 0.98);
  }

  const stability = clamp((tSpentSec / 18), 0.2, 1.0);
  let pAcc = clamp(0.35 + (acc - accTarget) * 1.25, 0.05, 0.98);
  pAcc = clamp(pAcc * (0.7 + 0.3*stability), 0.05, 0.98);

  return { pGoal, pAcc, pWin: clamp(pGoal*pAcc, 0.02, 0.98) };
}

/**
 * Emit hha:ai feature frame (you decide fields)
 */
export function emitAIFrame(frame){
  emit('hha:ai', frame || {});
}