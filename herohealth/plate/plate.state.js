// === /herohealth/plate/plate.state.js ===
// PlateVR — HHA Standard State + Metrics + Grade + LastSummary
'use strict';

export function makeSessionId() {
  // stable-ish unique, no crypto required
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `PL-${t}-${r}`;
}

export function buildHhaContextFromQuery(Q) {
  // Keep the same “research context” keys across games
  const get = (k, d = '') => (Q && Q.get(k) != null ? String(Q.get(k)) : d);

  // Normalize runMode if hub sends runMode but game uses run
  const runMode = get('runMode', get('run', 'play'));

  return {
    timestampIso: get('timestampIso', new Date().toISOString()),
    projectTag: get('projectTag', 'HeroHealth'),
    runMode,

    studyId: get('studyId', ''),
    phase: get('phase', ''),
    conditionGroup: get('conditionGroup', ''),
    sessionOrder: get('sessionOrder', ''),
    blockLabel: get('blockLabel', ''),
    siteCode: get('siteCode', ''),
    schoolYear: get('schoolYear', ''),
    semester: get('semester', ''),

    studentKey: get('studentKey', ''),
    schoolCode: get('schoolCode', ''),
    schoolName: get('schoolName', ''),
    classRoom: get('classRoom', ''),
    studentNo: get('studentNo', ''),
    nickName: get('nickName', ''),
    gender: get('gender', ''),
    age: get('age', ''),
    gradeLevel: get('gradeLevel', ''),
  };
}

export function makeInitialState(opts = {}) {
  const totalTime = Math.max(20, Number(opts.totalTime) || 70);
  const livesMax = Math.max(1, Number(opts.livesMax) || 3);

  return {
    // meta
    game: 'PlateVR',
    ctx: opts.ctx || {},
    sessionId: String(opts.sessionId || makeSessionId()),
    version: 'plate.safe.hha-standard.v1',

    // runtime flags
    booted: false,
    started: false,
    running: false,
    paused: false,

    // time
    totalTime,
    timeLeft: totalTime,
    tStart: 0,
    endedAt: 0,

    // core scoring
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    perfectCount: 0,

    // lives/shield/fever
    livesMax,
    lives: livesMax,
    shieldMax: 5,
    shield: 0,
    fever: 0,
    feverOn: false,

    // plate (groups)
    groupsTotal: 5,
    plateHave: new Set(),
    groupCounts: [0, 0, 0, 0, 0],

    // goals/minis
    goalsCleared: 0,
    minisCleared: 0,
    goalIndex: 0,
    activeGoal: null,
    activeMini: null,
    miniEndsAt: 0,
    miniUrgentArmed: false,
    miniTickAt: 0,
    _mini: null,

    // spawn/targets
    targets: [],
    nextSpawnAt: 0,
    aimedId: null,

    // power timers
    slowUntil: 0,
    noJunkUntil: 0,
    stormUntil: 0,

    // boss
    bossActive: false,
    bossNextAt: 0,

    // UI binding tries
    _uiDelegated: false,
    _uiBindTries: 0,

    // low-time tick
    lowTimeLastSec: null,

    // ---------- Research metrics (HHA Standard) ----------
    // spawn counts
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetGoldSpawned: 0,
    nTargetTrapSpawned: 0,
    nTargetFakeSpawned: 0,
    nTargetSlowSpawned: 0,
    nTargetNoJunkSpawned: 0,
    nTargetStormSpawned: 0,
    nTargetBossSpawned: 0,

    // hit counts
    nHitGood: 0,
    nHitGold: 0,
    nHitJunk: 0,
    nHitTrap: 0,
    nHitFake: 0,
    nHitBoss: 0,
    nHitBossDown: 0,
    nHitPower: 0,

    // blocks/expire/miss types
    nShieldBlock: 0,
    nExpireGood: 0,   // good/gold expired
    nAirShot: 0,

    // RT samples (good hits only; includes gold)
    rtGoodMs: [],

    // for fast hit rate
    fastHitUnderMs: 500,
  };
}

export function resetState(S, opts = {}) {
  const keep = {
    game: S.game,
    ctx: S.ctx,
    version: S.version,
  };

  const next = makeInitialState({
    totalTime: opts.totalTime ?? S.totalTime,
    livesMax: opts.livesMax ?? S.livesMax,
    sessionId: opts.sessionId ?? S.sessionId,
    ctx: S.ctx,
  });

  // restore keep
  next.game = keep.game;
  next.ctx = keep.ctx;
  next.version = keep.version;

  // mutate original reference
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, next);
  return S;
}

export function computeGradeFrom(S) {
  // Simple, stable across devices.
  // Reward score + perfect + combo, penalize miss.
  const base = Number(S.score) || 0;
  const bonus = (Number(S.perfectCount) || 0) * 80 + (Number(S.maxCombo) || 0) * 50;
  const penalty = (Number(S.miss) || 0) * 250;
  const p = Math.max(0, base + bonus - penalty);

  // Tune thresholds to your current scoring scale
  if (p >= 15000) return 'SSS';
  if (p >= 12000) return 'SS';
  if (p >= 9000) return 'S';
  if (p >= 6500) return 'A';
  if (p >= 4000) return 'B';
  return 'C';
}

function avg(arr) {
  if (!arr || !arr.length) return 0;
  let s = 0;
  for (const v of arr) s += Number(v) || 0;
  return s / arr.length;
}

function median(arr) {
  if (!arr || !arr.length) return 0;
  const a = arr.slice().map(v => Number(v) || 0).sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function computeMetrics(S) {
  const goodSpawn = (S.nTargetGoodSpawned || 0) + (S.nTargetGoldSpawned || 0);
  const goodHit = (S.nHitGood || 0) + (S.nHitGold || 0);

  // "junk error" = hit junk/trap/fake + boss attack hits counted as misses elsewhere
  const junkErr = (S.nHitJunk || 0) + (S.nHitTrap || 0) + (S.nHitFake || 0);

  const accuracyGoodPct = goodSpawn > 0 ? (goodHit / goodSpawn) * 100 : 0;
  const junkErrorPct = (goodHit + junkErr) > 0 ? (junkErr / (goodHit + junkErr)) * 100 : 0;

  const rtArr = Array.isArray(S.rtGoodMs) ? S.rtGoodMs : [];
  const avgRtGoodMs = Math.round(avg(rtArr));
  const medianRtGoodMs = Math.round(median(rtArr));
  const fastHitRatePct = rtArr.length
    ? (rtArr.filter(x => (Number(x) || 0) <= (S.fastHitUnderMs || 500)).length / rtArr.length) * 100
    : 0;

  return {
    accuracyGoodPct: round1(accuracyGoodPct),
    junkErrorPct: round1(junkErrorPct),
    avgRtGoodMs,
    medianRtGoodMs,
    fastHitRatePct: round1(fastHitRatePct),

    // counts
    goodSpawn,
    goodHit,
    junkErr,
    shieldBlocks: S.nShieldBlock || 0,
    expireGood: S.nExpireGood || 0,
    airShot: S.nAirShot || 0,
  };
}

function round1(x) {
  const n = Number(x) || 0;
  return Math.round(n * 10) / 10;
}

export function buildLastSummary(S, meta = {}) {
  const metrics = computeMetrics(S);

  return {
    timestampIso: new Date().toISOString(),
    projectTag: S.ctx?.projectTag || 'HeroHealth',
    game: 'PlateVR',

    runMode: meta.runMode || meta.run || S.ctx?.runMode || 'play',
    mode: meta.mode || 'play',
    diff: meta.diff || 'normal',
    seed: meta.seed,

    sessionId: S.sessionId,
    durationPlannedSec: S.totalTime,
    durationPlayedSec: Math.round((S.endedAt && S.tStart) ? (Math.max(0, S.endedAt - S.tStart) / 1000) : (S.totalTime - S.timeLeft)),

    scoreFinal: S.score,
    comboMax: S.maxCombo,
    misses: S.miss,
    perfect: S.perfectCount,
    grade: computeGradeFrom(S),

    goalsCleared: Math.min(2, S.goalsCleared || 0),
    goalsTotal: 2,
    miniCleared: Math.min(7, S.minisCleared || 0),
    miniTotal: 7,

    groupCounts: {
      g1: S.groupCounts?.[0] || 0,
      g2: S.groupCounts?.[1] || 0,
      g3: S.groupCounts?.[2] || 0,
      g4: S.groupCounts?.[3] || 0,
      g5: S.groupCounts?.[4] || 0,
      total: (S.groupCounts || []).reduce((a, b) => a + (Number(b) || 0), 0),
    },

    metrics,

    // attach research context (flat)
    ...S.ctx,
  };
}
