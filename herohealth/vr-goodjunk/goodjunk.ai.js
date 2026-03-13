// === /herohealth/vr-goodjunk/goodjunk.ai.js ===
// GoodJunk Solo Master Pack
// FULL PATCH v20260313b-GJ-AI-SOLO-MASTER

'use strict';

export function clamp(v, a, b) {
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

export function median(arr) {
  const a = Array.isArray(arr) ? arr.filter(Number.isFinite) : [];
  if (!a.length) return 0;
  a.sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

export function createRollingTracker() {
  return {
    events: [],
    maxAgeMs: 20000
  };
}

export function pushRollingEvent(tracker, event) {
  if (!tracker || !Array.isArray(tracker.events)) return;
  tracker.events.push({
    atMs: Number(event?.atMs || 0),
    type: String(event?.type || ''),
    good: !!event?.good,
    junk: !!event?.junk,
    miss: !!event?.miss,
    expire: !!event?.expire,
    rt: Number(event?.rt || 0),
    comboBreak: !!event?.comboBreak,
    scoreDelta: Number(event?.scoreDelta || 0)
  });
}

export function trimRolling(tracker, nowMs) {
  if (!tracker || !Array.isArray(tracker.events)) return;
  const cut = Number(nowMs || 0) - Number(tracker.maxAgeMs || 20000);
  while (tracker.events.length && tracker.events[0].atMs < cut) {
    tracker.events.shift();
  }
}

function sliceWindow(tracker, nowMs, winMs) {
  if (!tracker || !Array.isArray(tracker.events)) return [];
  const cut = Number(nowMs || 0) - Number(winMs || 0);
  return tracker.events.filter(e => e.atMs >= cut);
}

function ratio(n, d) {
  if (!d) return 0;
  return n / d;
}

export function extractRollingFeatures(tracker, nowMs) {
  const last5 = sliceWindow(tracker, nowMs, 5000);
  const last10 = sliceWindow(tracker, nowMs, 10000);
  const last20 = sliceWindow(tracker, nowMs, 20000);

  const calc = (rows) => {
    const shots = rows.filter(r => r.type === 'hit' || r.type === 'miss-shot').length;
    const hits = rows.filter(r => r.type === 'hit').length;
    const junkHits = rows.filter(r => r.junk).length;
    const goodHits = rows.filter(r => r.good).length;
    const expires = rows.filter(r => r.expire).length;
    const misses = rows.filter(r => r.miss).length;
    const comboBreaks = rows.filter(r => r.comboBreak).length;
    const rts = rows.map(r => r.rt).filter(v => v > 0);

    return {
      count: rows.length,
      shots,
      hits,
      junkHits,
      goodHits,
      expires,
      misses,
      comboBreaks,
      accPct: shots ? Math.round((hits / shots) * 100) : 0,
      junkConfusionRate: ratio(junkHits, Math.max(1, hits)),
      expireRate: ratio(expires, Math.max(1, goodHits + expires)),
      missRate: ratio(misses, Math.max(1, shots)),
      comboBreakRate: ratio(comboBreaks, Math.max(1, rows.length)),
      medianRt: median(rts)
    };
  };

  return {
    last5: calc(last5),
    last10: calc(last10),
    last20: calc(last20)
  };
}

export function buildPredictionInput({
  state,
  rolling
} = {}) {
  const bossHpRatio = state?.bossHpMax > 0 ? state.bossHp / state.bossHpMax : 0;
  const shots = Number(state?.shots || 0);
  const hits = Number(state?.hits || 0);

  return {
    score: Number(state?.score || 0),
    accPct: shots ? Math.round((hits / shots) * 100) : 0,
    missTotal: Number(state?.missTotal || 0),
    missJunkHit: Number(state?.missJunkHit || 0),
    missGoodExpired: Number(state?.missGoodExpired || 0),
    combo: Number(state?.combo || 0),
    bestCombo: Number(state?.bestCombo || 0),
    fever: Number(state?.fever || 0),
    shield: Number(state?.shield || 0),
    tLeft: Number(state?.tLeft || 0),
    plannedSec: Number(state?.plannedSec || 0),
    phase: String(state?.phase || ''),
    goodHitCount: Number(state?.goodHitCount || 0),
    goodTarget: Number(state?.goodTarget || 0),
    bossHpRatio: clamp(bossHpRatio, 0, 1),

    rollingAcc5: Number(rolling?.last5?.accPct || 0),
    rollingAcc10: Number(rolling?.last10?.accPct || 0),
    rollingAcc20: Number(rolling?.last20?.accPct || 0),

    rollingMiss5: Number(rolling?.last5?.misses || 0),
    rollingMiss10: Number(rolling?.last10?.misses || 0),
    rollingMiss20: Number(rolling?.last20?.misses || 0),

    rollingRtMedian5: Number(rolling?.last5?.medianRt || 0),
    rollingRtMedian10: Number(rolling?.last10?.medianRt || 0),
    rollingRtMedian20: Number(rolling?.last20?.medianRt || 0),

    comboBreakRate5: Number(rolling?.last5?.comboBreakRate || 0),
    comboBreakRate10: Number(rolling?.last10?.comboBreakRate || 0),

    junkConfusionRate5: Number(rolling?.last5?.junkConfusionRate || 0),
    junkConfusionRate10: Number(rolling?.last10?.junkConfusionRate || 0),

    expireRate5: Number(rolling?.last5?.expireRate || 0),
    expireRate10: Number(rolling?.last10?.expireRate || 0)
  };
}

export function predictSnapshot(input) {
  let hazardRisk = 0.15;
  let frustrationRisk = 0.12;
  let winChance = 0.50;
  let fatigueRisk = 0.10;
  let junkConfusionRisk = 0.08;
  let attentionDropRisk = 0.10;

  const topFactors = [];

  function addFactor(key, value, direction, impact = 0.05) {
    topFactors.push({ key, value, direction, impact });
  }

  if (input.rollingMiss10 >= 4) {
    hazardRisk += 0.18;
    frustrationRisk += 0.12;
    addFactor('rolling_miss_10s', input.rollingMiss10, 'up', 0.18);
  }

  if (input.junkConfusionRate10 >= 0.30) {
    hazardRisk += 0.16;
    junkConfusionRisk += 0.24;
    frustrationRisk += 0.08;
    addFactor('junk_confusion_10s', input.junkConfusionRate10, 'up', 0.16);
  }

  if (input.expireRate10 >= 0.28) {
    attentionDropRisk += 0.16;
    fatigueRisk += 0.10;
    addFactor('expire_rate_10s', input.expireRate10, 'up', 0.14);
  }

  if (input.rollingRtMedian10 >= 900) {
    fatigueRisk += 0.18;
    attentionDropRisk += 0.10;
    addFactor('rt_median_10s', input.rollingRtMedian10, 'up', 0.15);
  }

  if (input.comboBreakRate10 >= 0.18) {
    frustrationRisk += 0.12;
    addFactor('combo_break_rate_10s', input.comboBreakRate10, 'up', 0.10);
  }

  if (input.rollingAcc10 >= 80) {
    winChance += 0.16;
    hazardRisk -= 0.08;
    addFactor('rolling_acc_10s', input.rollingAcc10, 'down', 0.16);
  }

  if (input.bestCombo >= 10) {
    winChance += 0.10;
    frustrationRisk -= 0.06;
    addFactor('best_combo', input.bestCombo, 'down', 0.10);
  }

  if (input.score >= 500) {
    winChance += 0.10;
    addFactor('score', input.score, 'down', 0.08);
  }

  if (input.phase === 'boss_phase_2' || input.phase === 'last_stand') {
    hazardRisk += 0.08;
    frustrationRisk += 0.06;
    addFactor('late_boss_phase', input.phase, 'up', 0.08);
  }

  if (input.bossHpRatio > 0.60 && input.tLeft <= 14) {
    hazardRisk += 0.14;
    winChance -= 0.12;
    addFactor('boss_hp_ratio', input.bossHpRatio, 'up', 0.14);
  }

  if (input.tLeft <= 8) {
    hazardRisk += 0.08;
    fatigueRisk += 0.05;
    addFactor('time_left', input.tLeft, 'up', 0.07);
  }

  if (input.fever > 0) {
    winChance += 0.08;
    addFactor('fever_on', input.fever, 'down', 0.06);
  }

  hazardRisk = clamp(hazardRisk, 0, 0.99);
  frustrationRisk = clamp(frustrationRisk, 0, 0.99);
  winChance = clamp(winChance, 0.01, 0.99);
  fatigueRisk = clamp(fatigueRisk, 0, 0.99);
  junkConfusionRisk = clamp(junkConfusionRisk, 0, 0.99);
  attentionDropRisk = clamp(attentionDropRisk, 0, 0.99);

  let coach = 'กำลังไปได้ดี เลือกของดีต่อเนื่องไว้';
  let explainText = 'ยังคงจังหวะได้ดี';

  if (junkConfusionRisk >= 0.45) {
    coach = 'อย่ารีบยิง เป้าหลอกเริ่มเยอะขึ้น';
    explainText = 'พลาด junk บ่อยในช่วงล่าสุด';
  } else if (fatigueRisk >= 0.45) {
    coach = 'ค่อยลงจังหวะครึ่งนิด แล้วค่อยยิง';
    explainText = 'เวลาตอบเริ่มช้าลงต่อเนื่อง';
  } else if (attentionDropRisk >= 0.45) {
    coach = 'โฟกัสดูของดีให้ครบก่อนกดยิง';
    explainText = 'ปล่อยของดีหลุดหลายชิ้น';
  } else if (hazardRisk >= 0.55) {
    coach = 'ช่วงนี้อันตรายขึ้น เลือกชัวร์มากกว่ารัว';
    explainText = 'miss และ pressure กำลังสูง';
  } else if (winChance >= 0.75) {
    coach = 'เยี่ยมมาก! เร่งคอมโบต่อได้เลย';
    explainText = 'accuracy และ momentum กำลังดี';
  }

  topFactors.sort((a, b) => b.impact - a.impact);

  return {
    hazardRisk: +hazardRisk.toFixed(2),
    frustrationRisk: +frustrationRisk.toFixed(2),
    winChance: +winChance.toFixed(2),
    fatigueRisk: +fatigueRisk.toFixed(2),
    junkConfusionRisk: +junkConfusionRisk.toFixed(2),
    attentionDropRisk: +attentionDropRisk.toFixed(2),
    coach,
    explainText,
    topFactors: topFactors.slice(0, 4)
  };
}

export function buildDirectorAdjustment(input, pred, opts = {}) {
  const researchMode = !!opts.researchMode;
  if (researchMode) {
    return {
      spawnMul: 1,
      ttlMul: 1,
      junkBias: 0,
      bonusBias: 0,
      assistMode: 'deterministic'
    };
  }

  let spawnMul = 1;
  let ttlMul = 1;
  let junkBias = 0;
  let bonusBias = 0;
  let assistMode = 'none';

  if (pred.frustrationRisk >= 0.60 || pred.hazardRisk >= 0.68) {
    spawnMul *= 0.92;
    ttlMul *= 1.08;
    junkBias -= 0.06;
    bonusBias += 0.05;
    assistMode = 'relief';
  }

  if (pred.attentionDropRisk >= 0.52) {
    ttlMul *= 1.05;
    bonusBias += 0.03;
    assistMode = assistMode === 'none' ? 'focus' : assistMode;
  }

  if (pred.junkConfusionRisk >= 0.50) {
    junkBias -= 0.08;
    bonusBias += 0.02;
    assistMode = assistMode === 'none' ? 'clarify' : assistMode;
  }

  if (pred.winChance >= 0.82 && input.rollingAcc10 >= 82) {
    spawnMul *= 1.08;
    ttlMul *= 0.96;
    junkBias += 0.04;
    assistMode = 'challenge';
  }

  if (input.tLeft <= 10 && pred.winChance < 0.45) {
    bonusBias += 0.06;
    ttlMul *= 1.04;
    assistMode = 'comeback';
  }

  return {
    spawnMul: +clamp(spawnMul, 0.82, 1.18).toFixed(3),
    ttlMul: +clamp(ttlMul, 0.90, 1.16).toFixed(3),
    junkBias: +clamp(junkBias, -0.12, 0.10).toFixed(3),
    bonusBias: +clamp(bonusBias, 0.00, 0.14).toFixed(3),
    assistMode
  };
}

export function buildPredictionSnapshot({
  state,
  rolling
} = {}) {
  const input = buildPredictionInput({ state, rolling });
  const pred = predictSnapshot(input);
  return {
    input,
    pred
  };
}
