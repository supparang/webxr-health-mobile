// === /herohealth/plate/plate.state.js ===
// PlateVR state helpers — HHA Standard
// - makeInitialState / resetState
// - buildHhaContextFromQuery
// - makeSessionId
// - computeGradeFrom (SSS, SS, S, A, B, C)
// - buildLastSummary (HHA_LAST_SUMMARY)

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

export function makeSessionId(prefix='PLATE'){
  const t = Date.now();
  let r = 0;
  try{
    const u = new Uint32Array(1);
    (ROOT.crypto || ROOT.msCrypto).getRandomValues(u);
    r = u[0] >>> 0;
  }catch(_){
    r = ((Math.random()*1e9)>>>0);
  }
  return `${prefix}-${t}-${(r>>>0).toString(16).padStart(8,'0')}`;
}

export function buildHhaContextFromQuery(Q){
  // เก็บคีย์มาตรฐานที่เราใช้กันใน logger (เหมือนเกมอื่น ๆ)
  const keys = [
    'timestampIso','projectTag','runMode','studyId','phase','conditionGroup',
    'sessionOrder','blockLabel','siteCode','schoolYear','semester',
    'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName',
    'gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
    'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent'
  ];
  const ctx = {};
  for(const k of keys){
    const v = Q.get(k);
    if(v !== null && v !== '') ctx[k] = v;
  }
  // เผื่อ hub ส่ง run แต่ไม่ส่ง runMode
  if(!ctx.runMode){
    const run = String(Q.get('run') || '').toLowerCase();
    if(run) ctx.runMode = run;
  }
  return ctx;
}

export function makeInitialState(opts={}){
  const totalTime = Math.max(20, Number(opts.totalTime||70));
  const livesMax  = Math.max(1, Number(opts.livesMax||3));
  const sessionId = String(opts.sessionId || makeSessionId());
  const ctx       = opts.ctx || {};

  return {
    // meta
    ctx,
    sessionId,

    // time
    totalTime,
    tStart: 0,
    timeLeft: totalTime,
    lowTimeLastSec: null,

    // flags
    booted: false,
    started: false,
    running: false,
    paused: false,

    // score
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    perfectCount: 0,

    // fever/shield
    fever: 0,
    feverOn: false,
    shield: 0,
    shieldMax: 3,

    // lives
    livesMax,
    lives: livesMax,

    // plate progress
    groupsTotal: 5,
    plateHave: new Set(),
    groupCounts: [0,0,0,0,0], // G1..G5 hits count

    // quests
    goalsCleared: 0,
    goalIndex: 0,
    activeGoal: null,

    minisCleared: 0,
    activeMini: null,
    miniEndsAt: 0,
    miniUrgentArmed: false,
    miniTickAt: 0,
    _mini: null,

    // target system
    targets: [],
    aimedId: null,
    nextSpawnAt: 0,

    // boss/power windows
    bossActive: false,
    bossNextAt: 0,
    slowUntil: 0,
    noJunkUntil: 0,
    stormUntil: 0,

    // ui bind tries
    _uiDelegated: false,
    _uiBindTries: 0,
  };
}

export function resetState(S, opts={}){
  const totalTime = Math.max(20, Number(opts.totalTime || S.totalTime || 70));
  const livesMax  = Math.max(1, Number(opts.livesMax  || S.livesMax  || 3));
  const sessionId = String(opts.sessionId || S.sessionId || makeSessionId());

  // เคลียร์ค่าที่ “ต้องรีเซ็ต” ระหว่าง restart
  S.sessionId = sessionId;

  S.totalTime = totalTime;
  S.tStart = 0;
  S.timeLeft = totalTime;
  S.lowTimeLastSec = null;

  S.started = true;
  S.running = false;
  S.paused = false;

  S.score = 0;
  S.combo = 0;
  S.maxCombo = 0;
  S.miss = 0;
  S.perfectCount = 0;

  S.fever = 0;
  S.feverOn = false;
  S.shield = 0;
  S.shieldMax = S.shieldMax || 3;

  S.livesMax = livesMax;
  S.lives = livesMax;

  S.groupsTotal = 5;
  S.plateHave = new Set();
  S.groupCounts = [0,0,0,0,0];

  S.goalsCleared = 0;
  S.goalIndex = 0;
  S.activeGoal = null;

  S.minisCleared = 0;
  S.activeMini = null;
  S.miniEndsAt = 0;
  S.miniUrgentArmed = false;
  S.miniTickAt = 0;
  S._mini = null;

  S.targets = [];
  S.aimedId = null;
  S.nextSpawnAt = 0;

  S.bossActive = false;
  S.bossNextAt = 0;
  S.slowUntil = 0;
  S.noJunkUntil = 0;
  S.stormUntil = 0;

  S._uiBindTries = 0;
  return S;
}

export function computeGradeFrom(S){
  // เกรดตามที่ตกลง: SSS, SS, S, A, B, C
  // ใช้คะแนน+คอมโบ+เพอร์เฟค+ผ่านภารกิจ vs โทษ miss/เสียชีวิต
  const base = Number(S.score||0);
  const bonus =
    (Number(S.maxCombo||0) * 30) +
    (Number(S.perfectCount||0) * 60) +
    (Number(S.goalsCleared||0) * 400) +
    (Number(S.minisCleared||0) * 150);

  const lifeLost = Math.max(0, Number(S.livesMax||0) - Number(S.lives||0));
  const penalty =
    (Number(S.miss||0) * 250) +
    (lifeLost * 300);

  const perf = base + bonus - penalty;

  // กันกรณีคะแนนติดลบเยอะ
  const p = Math.max(-9999, perf);

  // Thresholds (บาลานซ์สำหรับเวลา ~60–80s)
  if(p >= 16000 && S.miss <= 3) return 'SSS';
  if(p >= 13000) return 'SS';
  if(p >= 10500) return 'S';
  if(p >=  8000) return 'A';
  if(p >=  5000) return 'B';
  return 'C';
}

export function buildLastSummary(S, meta={}){
  const grade = computeGradeFrom(S);
  const nowIso = new Date().toISOString();

  const totalHit = (S.groupCounts||[]).reduce((a,b)=>a+(+b||0),0);
  const groups = {
    g1: (S.groupCounts&&S.groupCounts[0])||0,
    g2: (S.groupCounts&&S.groupCounts[1])||0,
    g3: (S.groupCounts&&S.groupCounts[2])||0,
    g4: (S.groupCounts&&S.groupCounts[3])||0,
    g5: (S.groupCounts&&S.groupCounts[4])||0,
    total: totalHit
  };

  return {
    // HHA standard-ish
    timestampIso: nowIso,
    game: 'PlateVR',
    sessionId: S.sessionId,
    run: meta.run || meta.runMode || 'play',
    mode: meta.mode || 'play',
    diff: meta.diff || 'normal',

    // performance
    scoreFinal: Number(S.score||0),
    grade,
    comboMax: Number(S.maxCombo||0),
    misses: Number(S.miss||0),
    perfect: Number(S.perfectCount||0),
    goalsCleared: Number(S.goalsCleared||0),
    goalsTotal: 2,
    minisCleared: Number(S.minisCleared||0),
    minisTotal: 7,
    livesMax: Number(S.livesMax||0),
    livesLeft: Number(S.lives||0),
    feverEnd: Math.round(Number(S.fever||0)),

    // plate stats
    groups,

    // carry research ctx (บางฟิลด์)
    ctx: S.ctx || {}
  };
}