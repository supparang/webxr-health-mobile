// === /herohealth/plate/plate.state.js ===
// PlateVR — State + Context helpers (HHA Standard)
// - centralize: sessionId, reset, grade, lastSummary, logger context

'use strict';

export function clamp(v, a, b){
  v = Number(v); if(!Number.isFinite(v)) v = 0;
  return Math.max(a, Math.min(b, v));
}

export function uid8(){
  return Math.random().toString(16).slice(2, 10);
}

export function makeSessionId(){
  return `PLATE-${Date.now()}-${uid8()}`;
}

// ✅ ดึง field งานวิจัยจาก query ให้ “เหมือนกันทุกเกม”
export function buildHhaContextFromQuery(Q){
  // Q = URLSearchParams
  const get = (k)=> {
    const v = Q.get(k);
    return (v === null) ? null : String(v);
  };

  const ctx = {
    timestampIso: get('timestampIso'),
    projectTag: get('projectTag'),
    runMode: get('runMode'),
    studyId: get('studyId'),
    phase: get('phase'),
    conditionGroup: get('conditionGroup'),
    sessionOrder: get('sessionOrder'),
    blockLabel: get('blockLabel'),
    siteCode: get('siteCode'),
    schoolYear: get('schoolYear'),
    semester: get('semester'),

    // student profile (optional)
    studentKey: get('studentKey'),
    schoolCode: get('schoolCode'),
    schoolName: get('schoolName'),
    classRoom: get('classRoom'),
    studentNo: get('studentNo'),
    nickName: get('nickName'),
    gender: get('gender'),
    age: get('age'),
    gradeLevel: get('gradeLevel'),
  };

  // ตัด null ออกให้สะอาด
  const clean = {};
  for (const k of Object.keys(ctx)){
    if (ctx[k] !== null && ctx[k] !== '') clean[k] = ctx[k];
  }
  return clean;
}

export function makeInitialState(opts = {}){
  const totalTime = Math.max(20, Number(opts.totalTime || 70));
  const livesMax  = Math.max(1, Number(opts.livesMax || 3));
  const sessionId = String(opts.sessionId || makeSessionId());
  const ctx       = opts.ctx || {};

  return {
    // runtime flags
    running:false, paused:false,
    started:false, booted:false,

    // time
    tStart:0, timeLeft: totalTime, timeTotal: totalTime,

    // score
    score:0, combo:0, maxCombo:0,
    miss:0, perfectCount:0,

    // fever/shield/lives
    fever:0, feverOn:false,
    shield:0, shieldMax:1,
    lives:livesMax, livesMax,

    // goals/minis
    goalsCleared:0, goalsTotal:2,
    minisCleared:0, minisTotal:7,
    goalIndex:0, activeGoal:null,
    activeMini:null, miniEndsAt:0, miniUrgentArmed:false, miniTickAt:0,

    // plate progress
    plateHave:new Set(), groupsTotal:5, groupCounts:[0,0,0,0,0],

    // targets
    targets:[], aimedId:null,
    nextSpawnAt:0,

    // boss + power
    bossActive:false, bossNextAt:0,
    stormUntil:0, slowUntil:0, noJunkUntil:0,

    // misc
    lowTimeLastSec:null,
    sessionId,

    // ui binding
    _uiDelegated:false,
    _uiBindTries:0,

    // logger context
    ctx,
  };
}

export function resetState(S, opts = {}){
  const totalTime = Math.max(20, Number(opts.totalTime || S.timeTotal || 70));
  const livesMax  = Math.max(1, Number(opts.livesMax  || S.livesMax  || 3));
  const sessionId = String(opts.sessionId || makeSessionId());

  S.running=false; S.paused=false;
  S.tStart=0;
  S.timeTotal = totalTime;
  S.timeLeft  = totalTime;

  S.score=0; S.combo=0; S.maxCombo=0;
  S.miss=0; S.perfectCount=0;

  S.fever=0; S.feverOn=false;
  S.shield=0; S.shieldMax=1;

  S.livesMax=livesMax;
  S.lives=livesMax;

  S.goalsCleared=0; S.goalsTotal=2;
  S.minisCleared=0; S.minisTotal=7;
  S.goalIndex=0; S.activeGoal=null;
  S.activeMini=null; S.miniEndsAt=0; S.miniUrgentArmed=false; S.miniTickAt=0;

  S.plateHave && S.plateHave.clear && S.plateHave.clear();
  S.groupsTotal=5;
  S.groupCounts=[0,0,0,0,0];

  S.targets.length=0;
  S.aimedId=null;
  S.nextSpawnAt=0;

  S.bossActive=false; S.bossNextAt=0;
  S.stormUntil=0; S.slowUntil=0; S.noJunkUntil=0;

  S.lowTimeLastSec=null;

  S.sessionId=sessionId;
  return S;
}

// ✅ เกรดเดียวกันทุกเกม
export function computeGradeFrom(S){
  const metric =
    (S.score || 0) +
    (S.perfectCount || 0) * 120 +
    (S.maxCombo || 0) * 35 -
    (S.miss || 0) * 260 -
    ((S.livesMax || 0) - (S.lives || 0)) * 180;

  if(metric>=8200) return 'SSS';
  if(metric>=6200) return 'SS';
  if(metric>=4600) return 'S';
  if(metric>=3000) return 'A';
  if(metric>=1700) return 'B';
  return 'C';
}

export function buildLastSummary(S, extra = {}){
  return {
    game:'PlateVR',
    sessionId: S.sessionId,
    run: extra.run ?? 'play',
    mode: extra.mode ?? 'play',
    diff: extra.diff ?? 'normal',
    score: S.score,
    maxCombo: S.maxCombo,
    miss: S.miss,
    perfect: S.perfectCount,
    goals: `${Math.min(S.goalsCleared,2)}/2`,
    minis: `${Math.min(S.minisCleared,7)}/7`,
    groupCounts: Array.isArray(S.groupCounts) ? [...S.groupCounts] : [],
    ts: Date.now()
  };
}