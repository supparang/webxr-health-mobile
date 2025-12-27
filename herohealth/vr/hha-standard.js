// === /herohealth/vr/hha-standard.js ===
// HeroHealth — Standard Core v1.0 (shared across all games)
// ✅ deterministic RNG (seeded) / random fallback
// ✅ grade computation (SSS/SS/S/A/B/C)
// ✅ soft end + hard end helpers
// ✅ payload helpers for hha:end / hha:score

'use strict';

export function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function emitEvt(type, detail){
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch(_) {}
  try { document.dispatchEvent(new CustomEvent(type, { detail })); } catch(_) {}
}

export function hashSeed(str){
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seedUint32){
  let x = (seedUint32 >>> 0) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

export function createRandom({ deterministic=false, seed='0' } = {}){
  const det = !!deterministic;
  const s = String(seed ?? '0');
  const R = det ? makeRng(hashSeed(s)) : Math.random;

  return {
    deterministic: det,
    seed: s,
    r: ()=> R(),
    rnd: (a,b)=> a + R()*(b-a),
    rndi: (a,b)=> Math.floor(a + R()*(b-a+1)),
    pick: (arr)=> arr[Math.floor(R()*arr.length)] || arr[0]
  };
}

// Standard grade: same for all games
// Inputs: accPct [0..100], miss, goalsCleared/goalsTotal, minisCleared/minisTotal
export function computeGrade({ accPct=0, miss=0, goalsCleared=0, goalsTotal=2, minisCleared=0, minisTotal=7 } = {}){
  accPct = clamp(accPct, 0, 100);
  miss = Math.max(0, Number(miss)||0);

  const gPct = (goalsTotal>0) ? clamp(goalsCleared/goalsTotal, 0, 1) : 0;
  const mPct = (minisTotal>0) ? clamp(minisCleared/minisTotal, 0, 1) : 0;

  let score = 0;
  score += Math.min(60, accPct * 0.6); // 0..60
  score += (gPct * 20);               // 0..20
  score += (mPct * 20);               // 0..20
  score -= Math.min(25, miss * 3.0);  // 0..-25

  if (score >= 92) return 'SSS';
  if (score >= 84) return 'SS';
  if (score >= 76) return 'S';
  if (score >= 62) return 'A';
  if (score >= 48) return 'B';
  return 'C';
}

// SoftEnd gate: call once when goals complete
export function makeSoftEndGate({ onSoftEnd } = {}){
  let fired = false;
  return function maybeSoftEnd({ goalsCleared=0, goalsTotal=2 } = {}){
    if (fired) return false;
    if (goalsTotal>0 && goalsCleared >= goalsTotal){
      fired = true;
      try { onSoftEnd?.(); } catch(_) {}
      return true;
    }
    return false;
  };
}

// Standard end payload builder (merge with context)
export function buildEndPayload(core){
  // core must already contain fields used across games
  return {
    timestampIso: core.timestampIso,
    projectTag: core.projectTag,
    runMode: core.runMode,
    sessionId: core.sessionId,

    gameMode: core.gameMode,
    diff: core.diff,
    durationPlannedSec: core.durationPlannedSec,
    durationPlayedSec: core.durationPlayedSec,

    scoreFinal: core.scoreFinal,
    comboMax: core.comboMax,
    misses: core.misses,

    goalsCleared: core.goalsCleared,
    goalsTotal: core.goalsTotal,
    miniCleared: core.miniCleared,
    miniTotal: core.miniTotal,

    accuracyGoodPct: core.accuracyGoodPct ?? core.accuracyPct ?? 0,
    avgRtGoodMs: core.avgRtGoodMs ?? 0,
    medianRtGoodMs: core.medianRtGoodMs ?? 0,

    grade: core.grade,

    deterministic: core.deterministic ? 1 : 0,
    seed: String(core.seed ?? ''),

    device: core.device ?? (navigator.userAgent || 'unknown'),
    gameVersion: core.gameVersion ?? 'hha-standard-v1',

    reason: core.reason ?? 'time',
    startTimeIso: core.startTimeIso,
    endTimeIso: core.endTimeIso,

    ...(core.context || {})
  };
}
