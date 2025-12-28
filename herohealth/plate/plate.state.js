// === /herohealth/plate/plate.state.js ===
// PlateVR — State + Grade + Summary (HHA Standard-friendly)

'use strict';

export function makeSessionId(){
  // short but unique-ish
  return 'P' + Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}

export function buildHhaContextFromQuery(Q){
  // Q = URLSearchParams
  const pick = (k, d='') => {
    const v = Q.get(k);
    return (v === null || v === undefined) ? d : String(v);
  };

  // keep schema consistent with your logger sheet
  return {
    timestampIso: pick('timestampIso', ''),
    projectTag: pick('projectTag', 'HeroHealth'),
    runMode: pick('runMode', pick('run', 'play')),
    studyId: pick('studyId', ''),
    phase: pick('phase', ''),
    conditionGroup: pick('conditionGroup', ''),
    sessionOrder: pick('sessionOrder', ''),
    blockLabel: pick('blockLabel', ''),
    siteCode: pick('siteCode', ''),
    schoolYear: pick('schoolYear', ''),
    semester: pick('semester', ''),
    studentKey: pick('studentKey', ''),
    schoolCode: pick('schoolCode', ''),
    schoolName: pick('schoolName', ''),
    classRoom: pick('classRoom', ''),
    studentNo: pick('studentNo', ''),
    nickName: pick('nickName', ''),
    gender: pick('gender', ''),
    age: pick('age', ''),
    gradeLevel: pick('gradeLevel', ''),
  };
}

export function makeInitialState(opts = {}){
  const totalTime = Math.max(20, Number(opts.totalTime || 70) || 70);
  const livesMax  = Math.max(1, Number(opts.livesMax  || 3)  || 3);

  return {
    // run
    booted:false,
    started:false,
    running:false,
    paused:false,

    // session/context
    sessionId: String(opts.sessionId || makeSessionId()),
    ctx: opts.ctx || {},

    // time
    totalTime,
    timeLeft: totalTime,
    tStart: 0,
    nextSpawnAt: 0,
    lowTimeLastSec: null,

    // scoring
    score:0,
    combo:0,
    maxCombo:0,
    miss:0,
    perfectCount:0,

    // gameplay state
    livesMax,
    lives:livesMax,
    shieldMax:3,
    shield:0,
    fever:0,
    feverOn:false,

    // plate / groups
    groupsTotal:5,
    plateHave: new Set(),
    groupCounts:[0,0,0,0,0],

    // targets
    targets:[],
    aimedId:null,

    // powers
    slowUntil:0,
    noJunkUntil:0,
    stormUntil:0,

    // boss
    bossActive:false,
    bossNextAt:0,

    // quest
    goalsCleared:0,
    goalIndex:0,
    activeGoal:null,

    minisCleared:0,
    activeMini:null,
    miniEndsAt:0,
    miniUrgentArmed:false,
    miniTickAt:0,
    _mini:null,

    // ui binding retries
    _uiDelegated:false,
    _uiBindTries:0,
  };
}

export function resetState(S, opts = {}){
  const totalTime = Math.max(20, Number(opts.totalTime || S.totalTime || 70) || 70);
  const livesMax  = Math.max(1, Number(opts.livesMax  || S.livesMax  || 3)  || 3);

  S.running = false;
  S.paused  = false;

  S.totalTime = totalTime;
  S.timeLeft  = totalTime;
  S.tStart = 0;
  S.nextSpawnAt = 0;
  S.lowTimeLastSec = null;

  S.score=0; S.combo=0; S.maxCombo=0; S.miss=0; S.perfectCount=0;

  S.livesMax=livesMax;
  S.lives=livesMax;
  S.shield=0;

  S.fever=0;
  S.feverOn=false;

  S.plateHave = new Set();
  S.groupCounts = [0,0,0,0,0];

  S.targets = [];
  S.aimedId = null;

  S.slowUntil=0;
  S.noJunkUntil=0;
  S.stormUntil=0;

  S.bossActive=false;
  S.bossNextAt=0;

  S.goalsCleared=0;
  S.goalIndex=0;
  S.activeGoal=null;

  S.minisCleared=0;
  S.activeMini=null;
  S.miniEndsAt=0;
  S.miniUrgentArmed=false;
  S.miniTickAt=0;
  S._mini=null;

  if (opts.sessionId) S.sessionId = String(opts.sessionId);
}

export function computeGradeFrom(S){
  // Grade set: SSS, SS, S, A, B, C
  // Heuristic: score + penalty for miss (and tiny bonus for perfect)
  const score = Number(S.score||0);
  const miss  = Number(S.miss||0);
  const perf  = Number(S.perfectCount||0);

  const adj = score + perf*40 - miss*240;

  if (adj >= 9000) return 'SSS';
  if (adj >= 7200) return 'SS';
  if (adj >= 5600) return 'S';
  if (adj >= 3800) return 'A';
  if (adj >= 2200) return 'B';
  return 'C';
}

export function buildLastSummary(S, meta = {}){
  // Standard-ish summary object (stored to localStorage as HHA_LAST_SUMMARY)
  return {
    game: 'PlateVR',
    ts: Date.now(),
    sessionId: S.sessionId,
    run: meta.run || '',
    mode: meta.mode || '',
    diff: meta.diff || '',
    score: S.score,
    grade: computeGradeFrom(S),
    maxCombo: S.maxCombo,
    miss: S.miss,
    perfect: S.perfectCount,
    goalsCleared: S.goalsCleared,
    goalsTotal: 2,
    minisCleared: S.minisCleared,
    minisTotal: 7,
    groups: {
      g1: S.groupCounts[0],
      g2: S.groupCounts[1],
      g3: S.groupCounts[2],
      g4: S.groupCounts[3],
      g5: S.groupCounts[4],
      total: (S.groupCounts||[]).reduce((a,b)=>a+(Number(b)||0),0),
    },
    ctx: S.ctx || {}
  };
}
