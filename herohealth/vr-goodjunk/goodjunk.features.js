// === /herohealth/vr-goodjunk/goodjunk.features.js ===
// GoodJunk Feature Engineering
// FULL PATCH v20260315a-GJ-FEATURES-ML-READY

'use strict';

/**
 * Feature schema version สำหรับ log / research / model governance
 */
export const GJ_FEATURE_SCHEMA_VERSION = 'gj-feat-v1';

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function safeNum(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

function ratio(a, b, d=0){
  a = safeNum(a, 0);
  b = safeNum(b, 0);
  if(b <= 0) return d;
  return a / b;
}

function mean(arr, d=0){
  const xs = (Array.isArray(arr) ? arr : [])
    .map(x => Number(x))
    .filter(Number.isFinite);
  if(!xs.length) return d;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(arr, d=0){
  const xs = (Array.isArray(arr) ? arr : [])
    .map(x => Number(x))
    .filter(Number.isFinite)
    .sort((a,b)=>a-b);

  if(!xs.length) return d;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

function stddev(arr, d=0){
  const xs = (Array.isArray(arr) ? arr : [])
    .map(x => Number(x))
    .filter(Number.isFinite);

  if(xs.length < 2) return d;

  const mu = mean(xs, 0);
  const variance = mean(xs.map(x => (x - mu) ** 2), 0);
  return Math.sqrt(variance);
}

/**
 * rolling object ที่คาดหวังโดยประมาณ:
 * {
 *   hitRate5s,
 *   missRate5s,
 *   expireRate5s,
 *   junkHitRate5s,
 *   goodHitRate5s,
 *   comboBreakRate10s,
 *   scoreDelta5s,
 *   rtGoodMs: []
 * }
 */
export function buildFeatureVector({
  state = {},
  rolling = {},
  profile = {},
  context = {}
} = {}){
  const shots = safeNum(state.shots, 0);
  const hits = safeNum(state.hits, 0);
  const missTotal = safeNum(state.missTotal, 0);
  const missGoodExpired = safeNum(state.missGoodExpired, 0);
  const missJunkHit = safeNum(state.missJunkHit, 0);
  const combo = safeNum(state.combo, 0);
  const comboBest = safeNum(state.bestCombo ?? state.comboBest, 0);
  const fever = safeNum(state.fever, 0);
  const shield = safeNum(state.shield, 0);
  const score = safeNum(state.score, 0);
  const tLeft = safeNum(state.tLeft, 0);
  const plannedSec = Math.max(1, safeNum(state.plannedSec, 1));
  const goodHitCount = safeNum(state.goodHitCount, 0);
  const goodTarget = Math.max(1, safeNum(state.goodTarget, 1));
  const bossHp = safeNum(state.bossHp, 0);
  const bossHpMax = Math.max(1, safeNum(state.bossHpMax, 1));
  const stage = safeNum(state.stage, 0);

  const accPct = shots > 0 ? (hits / shots) * 100 : 0;
  const progressPct = (1 - (tLeft / plannedSec)) * 100;
  const goalPct = (goodHitCount / goodTarget) * 100;
  const bossHpPct = (bossHp / bossHpMax) * 100;

  const rtGoodMs = Array.isArray(rolling.rtGoodMs) ? rolling.rtGoodMs : [];
  const rtMedian = median(rtGoodMs, 0);
  const rtMean = mean(rtGoodMs, 0);
  const rtStd = stddev(rtGoodMs, 0);

  const hitRate5s = safeNum(rolling.hitRate5s, 0);
  const missRate5s = safeNum(rolling.missRate5s, 0);
  const expireRate5s = safeNum(rolling.expireRate5s, 0);
  const junkHitRate5s = safeNum(rolling.junkHitRate5s, 0);
  const goodHitRate5s = safeNum(rolling.goodHitRate5s, 0);
  const comboBreakRate10s = safeNum(rolling.comboBreakRate10s, 0);
  const scoreDelta5s = safeNum(rolling.scoreDelta5s, 0);

  const frustrationBaseline = safeNum(profile.frustrationBaseline, 0.5);
  const fatigueBaseline = safeNum(profile.fatigueBaseline, 0.5);
  const confusionBaseline = safeNum(profile.confusionBaseline, 0.5);

  const isBoss = context.isBoss ? 1 : 0;
  const isMobile = context.view === 'mobile' ? 1 : 0;
  const isVR = (context.view === 'cvr' || context.view === 'vr') ? 1 : 0;
  const diffEasy = context.diff === 'easy' ? 1 : 0;
  const diffHard = context.diff === 'hard' ? 1 : 0;

  return {
    schemaVersion: GJ_FEATURE_SCHEMA_VERSION,

    // progress
    progressPct: clamp(progressPct, 0, 100),
    timeLeftPct: clamp((tLeft / plannedSec) * 100, 0, 100),
    goalPct: clamp(goalPct, 0, 100),
    bossHpPct: clamp(bossHpPct, 0, 100),

    // raw performance
    score,
    accPct: clamp(accPct, 0, 100),
    shots,
    hits,
    missTotal,
    missGoodExpired,
    missJunkHit,
    combo,
    comboBest,
    streakPressure: clamp(missTotal + comboBreakRate10s * 3, 0, 999),
    fever,
    shield,

    // rolling
    hitRate5s,
    missRate5s,
    expireRate5s,
    junkHitRate5s,
    goodHitRate5s,
    comboBreakRate10s,
    scoreDelta5s,

    // behavior proxies
    junkConfusionRatio: clamp(ratio(missJunkHit, Math.max(1, hits), 0), 0, 1),
    expirePressureRatio: clamp(ratio(missGoodExpired, Math.max(1, missTotal), 0), 0, 1),
    rtMedian,
    rtMean,
    rtStd,

    // context
    stage,
    isBoss,
    isMobile,
    isVR,
    diffEasy,
    diffHard,

    // prior / profile
    frustrationBaseline,
    fatigueBaseline,
    confusionBaseline
  };
}

export function featureVectorToArray(f){
  return [
    safeNum(f.progressPct),
    safeNum(f.timeLeftPct),
    safeNum(f.goalPct),
    safeNum(f.bossHpPct),

    safeNum(f.score),
    safeNum(f.accPct),
    safeNum(f.shots),
    safeNum(f.hits),
    safeNum(f.missTotal),
    safeNum(f.missGoodExpired),
    safeNum(f.missJunkHit),
    safeNum(f.combo),
    safeNum(f.comboBest),
    safeNum(f.streakPressure),
    safeNum(f.fever),
    safeNum(f.shield),

    safeNum(f.hitRate5s),
    safeNum(f.missRate5s),
    safeNum(f.expireRate5s),
    safeNum(f.junkHitRate5s),
    safeNum(f.goodHitRate5s),
    safeNum(f.comboBreakRate10s),
    safeNum(f.scoreDelta5s),

    safeNum(f.junkConfusionRatio),
    safeNum(f.expirePressureRatio),
    safeNum(f.rtMedian),
    safeNum(f.rtMean),
    safeNum(f.rtStd),

    safeNum(f.stage),
    safeNum(f.isBoss),
    safeNum(f.isMobile),
    safeNum(f.isVR),
    safeNum(f.diffEasy),
    safeNum(f.diffHard),

    safeNum(f.frustrationBaseline),
    safeNum(f.fatigueBaseline),
    safeNum(f.confusionBaseline)
  ];
}

export function explainTopFactors(features = {}){
  const notes = [];

  if(safeNum(features.accPct) < 55){
    notes.push({ key:'accPct', label:'ความแม่นต่ำ', impact:0.88 });
  }
  if(safeNum(features.junkConfusionRatio) > 0.22){
    notes.push({ key:'junkConfusionRatio', label:'สับสนของดี/ของไม่ดี', impact:0.84 });
  }
  if(safeNum(features.expirePressureRatio) > 0.45){
    notes.push({ key:'expirePressureRatio', label:'ปล่อยของดีหลุดบ่อย', impact:0.79 });
  }
  if(safeNum(features.comboBreakRate10s) > 1.5){
    notes.push({ key:'comboBreakRate10s', label:'คอมโบขาดบ่อย', impact:0.75 });
  }
  if(safeNum(features.rtMedian) > 1200){
    notes.push({ key:'rtMedian', label:'ตอบสนองช้าลง', impact:0.73 });
  }
  if(safeNum(features.scoreDelta5s) < 0){
    notes.push({ key:'scoreDelta5s', label:'คะแนนช่วงหลังลดลง', impact:0.68 });
  }
  if(safeNum(features.goalPct) > 75){
    notes.push({ key:'goalPct', label:'เข้าใกล้เป้าหมายแล้ว', impact:0.65 });
  }
  if(safeNum(features.accPct) > 85){
    notes.push({ key:'accPct', label:'ความแม่นดีมาก', impact:0.64 });
  }

  return notes
    .sort((a,b)=> safeNum(b.impact) - safeNum(a.impact))
    .slice(0, 3);
}