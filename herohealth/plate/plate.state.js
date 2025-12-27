// === /herohealth/plate/plate.state.js ===
// PlateVR — HHA Standard State + Context + Grade + LastSummary
// ✅ makeInitialState / resetState
// ✅ buildHhaContextFromQuery (context fields for logger)
// ✅ computeGradeFrom (SSS, SS, S, A, B, C)
// ✅ buildLastSummary (HHA_LAST_SUMMARY standard)
// ✅ makeSessionId

'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
const n2 = (x, d=0)=>{ const v=Number(x); return Number.isFinite(v)?v:d; };

export function makeSessionId(){
  // short + unique enough for sessions
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2,8);
  return `PLT_${a}_${b}`;
}

export function buildHhaContextFromQuery(Q){
  // Keep aligned with your session sheet columns (safe if missing)
  const get = (k, d='') => {
    try{
      const v = Q.get(k);
      return (v===null || v===undefined) ? d : String(v);
    }catch(_){ return d; }
  };
  const geti = (k, d=0)=> {
    const v = parseInt(get(k,''), 10);
    return Number.isFinite(v) ? v : d;
  };

  const ctx = {
    timestampIso: get('timestampIso',''),
    projectTag: get('projectTag','HeroHealth'),
    runMode: get('runMode', get('run','play')),
    studyId: get('studyId',''),
    phase: get('phase',''),
    conditionGroup: get('conditionGroup',''),
    sessionOrder: get('sessionOrder',''),
    blockLabel: get('blockLabel',''),
    siteCode: get('siteCode',''),
    schoolYear: get('schoolYear',''),
    semester: get('semester',''),

    studentKey: get('studentKey',''),
    schoolCode: get('schoolCode',''),
    schoolName: get('schoolName',''),
    classRoom: get('classRoom',''),
    studentNo: get('studentNo',''),
    nickName: get('nickName',''),
    gender: get('gender',''),
    age: get('age',''),
    gradeLevel: get('gradeLevel',''),

    device: get('device',''),
    gameVersion: get('gameVersion', get('ver','')),
  };

  // normalize some known variants
  if(!ctx.runMode) ctx.runMode = get('run','play');

  return ctx;
}

function zeroMetrics(){
  return {
    // spawn/hit/expire by kind
    spawn: Object.create(null),
    hit: Object.create(null),
    expire: Object.create(null),

    // miss reasons + blocks
    miss: Object.create(null),
    shield_block: Object.create(null),

    // other counters
    air_shot: 0,
    boss_attack: 0,
    boss_dodge: 0,

    // powerups
    power: Object.create(null),
  };
}

export function makeInitialState(opts={}){
  const totalTime = Math.max(20, n2(opts.totalTime, 70));
  const livesMax  = Math.max(1, n2(opts.livesMax, 3));
  const sessionId = String(opts.sessionId || makeSessionId());
  const ctx       = (opts.ctx && typeof opts.ctx === 'object') ? opts.ctx : {};

  const S = {
    // core
    totalTime,
    timeLeft: totalTime,
    tStart: 0,
    running: false,
    paused: false,
    started: false,
    booted: false,

    // gameplay
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    perfectCount: 0,

    fever: 0,
    feverOn: false,

    shield: 0,
    shieldMax: 3,

    lives: livesMax,
    livesMax,

    groupsTotal: 5,
    plateHave: new Set(),
    groupCounts: [0,0,0,0,0],

    // quests
    goalsCleared: 0,
    minisCleared: 0,
    goalIndex: 0,
    activeGoal: null,
    activeMini: null,
    miniEndsAt: 0,
    miniUrgentArmed: false,
    miniTickAt: 0,
    _mini: null,

    // targets
    targets: [],
    aimedId: null,
    nextSpawnAt: 0,

    // boss/power
    bossActive: false,
    bossNextAt: 0,
    slowUntil: 0,
    noJunkUntil: 0,
    stormUntil: 0,

    // session + ctx
    sessionId,
    ctx,

    // ui binding flags
    _uiDelegated: false,
    _uiBindTries: 0,
    lowTimeLastSec: null,

    // metrics
    metrics: zeroMetrics(),
  };

  return S;
}

export function resetState(S, opts={}){
  const totalTime = Math.max(20, n2(opts.totalTime, S.totalTime || 70));
  const livesMax  = Math.max(1, n2(opts.livesMax, S.livesMax || 3));
  const sessionId = String(opts.sessionId || S.sessionId || makeSessionId());

  // wipe dynamic
  S.totalTime = totalTime;
  S.timeLeft = totalTime;
  S.tStart = 0;
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
  S.livesMax = livesMax;
  S.lives = livesMax;

  S.groupsTotal = 5;
  S.plateHave = new Set();
  S.groupCounts = [0,0,0,0,0];

  S.goalsCleared = 0;
  S.minisCleared = 0;
  S.goalIndex = 0;
  S.activeGoal = null;
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

  S.sessionId = sessionId;

  S.lowTimeLastSec = null;

  S.metrics = zeroMetrics();

  return S;
}

export function computeGradeFrom(S){
  // grade tiers: SSS, SS, S, A, B, C
  const t = Math.max(1, n2(S.totalTime, 70));
  const score = n2(S.score, 0);
  const miss = n2(S.miss, 0);
  const combo = n2(S.maxCombo, 0);

  // normalize
  let rate = score / t;              // points per sec
  rate -= miss * 2.6;                // penalty
  rate += Math.min(18, combo) * 0.7; // reward combo a bit

  if (rate >= 130) return 'SSS';
  if (rate >= 112) return 'SS';
  if (rate >= 95)  return 'S';
  if (rate >= 78)  return 'A';
  if (rate >= 60)  return 'B';
  return 'C';
}

export function buildLastSummary(S, meta={}){
  const nowIso = ()=> new Date().toISOString();
  const goalsTotal = 2;
  const minisTotal = 7;

  const sum = {
    game: 'PlateVR',
    ts: Date.now(),
    startTimeIso: meta.startTimeIso || '',
    endTimeIso: nowIso(),

    sessionId: String(S.sessionId || ''),
    run: String(meta.run || meta.runMode || ''),
    mode: String(meta.mode || ''),
    diff: String(meta.diff || ''),
    seed: (meta.seed===undefined ? null : meta.seed),

    timeTotal: n2(S.totalTime, 0),
    durationPlayedSec: n2(meta.durationPlayedSec, 0),

    scoreFinal: n2(S.score, 0),
    comboMax: n2(S.maxCombo, 0),
    misses: n2(S.miss, 0),
    livesLeft: n2(S.lives, 0),

    grade: String(meta.grade || computeGradeFrom(S)),

    perfect: n2(S.perfectCount, 0),

    goalsCleared: Math.min(goalsTotal, n2(S.goalsCleared, 0)),
    goalsTotal,

    miniCleared: Math.min(minisTotal, n2(S.minisCleared, 0)),
    miniTotal: minisTotal,

    g1: n2(S.groupCounts?.[0], 0),
    g2: n2(S.groupCounts?.[1], 0),
    g3: n2(S.groupCounts?.[2], 0),
    g4: n2(S.groupCounts?.[3], 0),
    g5: n2(S.groupCounts?.[4], 0),
    gTotal: (Array.isArray(S.groupCounts) ? S.groupCounts.reduce((a,b)=>a+n2(b,0),0) : 0),

    metrics: S.metrics || {},
    ctx: S.ctx || {},
  };

  return sum;
}