// === /webxr-health-mobile/herohealth/vr/goodjunk-model.js ===
// GoodJunk Tiny Model — PRODUCTION (no deps)
// Logistic regression style: risk = sigmoid(bias + w·x)
// FULL v20260302-GOODJUNK-MODEL-TINY
'use strict';

export function sigmoid(z){
  z = Number(z) || 0;
  if(z > 18) return 1;
  if(z < -18) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function dot(w, x){
  let s = 0;
  for(const k in w){
    if(k === 'bias') continue;
    const a = Number(w[k]) || 0;
    const b = Number(x[k]) || 0;
    s += a * b;
  }
  return s;
}

// Default weights (safe starter): tune via training later
export const DEFAULT_WEIGHTS = Object.freeze({
  bias: -1.10,

  // higher miss rate => risk up
  missRate:  3.20,
  junkRate:  2.40,

  // faster RT => risk down (negative)
  rtMedSec:  1.10,

  // combo protects (negative)
  comboNorm: -1.25,

  // low time pressure increases risk
  timeLeftNorm: -0.60,

  // fever helps but can distract: mild stabilizer (negative small)
  feverNorm: -0.20,

  // shield reduces risk
  shieldNorm: -0.55,

  // difficulty offsets
  diffHard:  0.35,
  diffEasy: -0.25
});

export function featurize(snap = {}){
  const shots = Math.max(0, Number(snap.shots || 0));
  const miss  = Math.max(0, Number(snap.miss  || 0));
  const hitJunk = Math.max(0, Number(snap.hitJunk || snap.hitsJunk || 0));
  const combo = Math.max(0, Number(snap.combo || 0));

  const timeLeftSec = Math.max(0, Number(snap.timeLeftSec ?? snap.tLeft ?? 0));
  const timeAllSec  = Math.max(1, Number(snap.timeAllSec  ?? snap.timeAll ?? 80));

  const rtMedMs = Number(snap.medianRtGoodMs || snap.rtMedMs || 0);
  const feverPct = Math.max(0, Math.min(100, Number(snap.feverPct || 0)));
  const shield = Math.max(0, Math.min(3, Number(snap.shield || 0)));

  const missRate = shots > 0 ? (miss / shots) : 0;
  const junkRate = shots > 0 ? (hitJunk / shots) : 0;

  const rtMedSec = rtMedMs > 0 ? (rtMedMs / 1000) : 1.2; // fallback
  const comboNorm = Math.min(1, combo / 25);

  const timeLeftNorm = Math.min(1, timeLeftSec / timeAllSec);
  const feverNorm = feverPct / 100;
  const shieldNorm = shield / 3;

  const diff = String(snap.diff || snap.difficulty || '').toLowerCase();
  const diffHard = diff === 'hard' ? 1 : 0;
  const diffEasy = diff === 'easy' ? 1 : 0;

  return {
    missRate,
    junkRate,
    rtMedSec,
    comboNorm,
    timeLeftNorm,
    feverNorm,
    shieldNorm,
    diffHard,
    diffEasy
  };
}

export function predictRisk(snap = {}, weights = DEFAULT_WEIGHTS){
  const x = featurize(snap);
  const z = (Number(weights.bias) || 0) + dot(weights, x);
  const risk = sigmoid(z);
  return { risk, z, x };
}