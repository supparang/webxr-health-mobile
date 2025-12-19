// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health Research Logger (Schema: sessions / events / students-profile)
// - sendBeacon first, fallback fetch(no-cors)
// - collects: sessions[1], events[*], studentsProfile[0..1] (upsert on server)
// - emits: hha:logger { ok:boolean, msg:string }
//
// ✅ PATCH (ครบชุด):
// 1) durationPlannedSec รองรับ opts.durationSec ด้วย
// 2) กัน bind ซ้ำ (handlers bind ครั้งเดียว แต่ทำงานกับ sessionRow ชุดล่าสุด)
// 3) รองรับ hha:questStats เพื่อเติม goalsCleared/goalsTotal/miniCleared/miniTotal ก่อน end
// 4) fetch fallback ใช้ Content-Type text/plain เพื่อลดปัญหา preflight/CORS

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  debug: false,
  gameVersion: 'v0'
};

let sessionId = null;
let sessionStartMs = 0;
let sessionStartIso = '';
let runMode = 'play';

let sessionRow = {};
let eventQueue = [];
let profileRow = null;

let lastScoreLogAt = 0;

// เก็บ rt good เพื่อคำนวณถ้า engine ไม่ส่ง stats มา
let _rtGood = [];
let _rtGoodFast = 0;
const FAST_RT_MS = 350;

// bind once
let _BOUND = false;

function isoNow(){ return new Date().toISOString(); }
function uuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}

function emitLogger(ok, msg){
  window.dispatchEvent(new CustomEvent('hha:logger', { detail:{ ok, msg } }));
  if (CONFIG.debug) console.log('[HHA Logger]', ok, msg);
}

function safeNum(v){ v = Number(v); return Number.isFinite(v) ? v : null; }
function safeStr(v){ return (v==null) ? '' : String(v); }

function flattenProfile(profile){
  const p = profile || {};
  return {
    studentKey: safeStr(p.studentKey || ''),
    schoolCode: safeStr(p.schoolCode || ''),
    schoolName: safeStr(p.schoolName || p.school || ''),
    classRoom:  safeStr(p.classRoom || p.room || p.class || ''),
    studentNo:  safeStr(p.studentNo || p.studentId || ''),
    nickName:   safeStr(p.nickName || p.name || ''),

    gender: safeStr(p.gender || ''),
    age: safeNum(p.age),
    gradeLevel: safeStr(p.gradeLevel || p.grade || ''),
    heightCm: safeNum(p.heightCm),
    weightKg: safeNum(p.weightKg),
    bmi: safeNum(p.bmi),
    bmiGroup: safeStr(p.bmiGroup || ''),

    vrExperience: safeStr(p.vrExperience || ''),
    gameFrequency: safeStr(p.gameFrequency || ''),
    handedness: safeStr(p.handedness || ''),
    visionIssue: safeStr(p.visionIssue || ''),
    healthDetail: safeStr(p.healthDetail || ''),
    consentParent: safeStr(p.consentParent || ''),
    consentTeacher: safeStr(p.consentTeacher || ''),

    profileSource: safeStr(p.profileSource || 'hub'),
    surveyKey: safeStr(p.surveyKey || ''),
    excludeFlag: safeStr(p.excludeFlag || ''),
    noteResearcher: safeStr(p.noteResearcher || '')
  };
}

function baseResearchMeta(meta){
  const m = meta || {};
  return {
    studyId: safeStr(m.studyId || ''),
    phase: safeStr(m.phase || ''),
    conditionGroup: safeStr(m.conditionGroup || ''),
    sessionOrder: safeStr(m.sessionOrder || ''),
    blockLabel: safeStr(m.blockLabel || ''),
    siteCode: safeStr(m.siteCode || ''),
    schoolYear: safeStr(m.schoolYear || ''),
    semester: safeStr(m.semester || '')
  };
}

function deviceLabel(){
  return safeStr(navigator.userAgent || '');
}

function packPayload(final=false){
  const events = eventQueue.splice(0, 800);
  return {
    projectTag: CONFIG.projectTag,
    sessions: [ { ...sessionRow } ],
    events,
    studentsProfile: profileRow ? [ { ...profileRow } ] : [],
    final,
    ts: Date.now()
  };
}

async function send(payload){
  if (!CONFIG.endpoint) throw new Error('No endpoint');
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon){
    const ok = navigator.sendBeacon(CONFIG.endpoint, new Blob([body], {type:'application/json'}));
    if (ok){
      emitLogger(true, payload.final ? 'logger: sent(final)' : 'logger: sent');
      return true;
    }
  }

  // ✅ no-cors ลดปัญหา preflight: ใช้ text/plain
  await fetch(CONFIG.endpoint, {
    method:'POST',
    mode:'no-cors',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body,
    keepalive: true
  });

  emitLogger(true, payload.final ? 'logger: sent(final/no-cors)' : 'logger: sent(no-cors)');
  return true;
}

function flush(final=false){
  if (!sessionId) return;
  if (!final && eventQueue.length === 0) return;

  const payload = packPayload(final);
  send(payload).catch(err=>{
    emitLogger(false, 'logger: send failed (check console)');
    console.warn('[HHA Logger] send failed', err);
  });
}

function pushEvent(row){
  eventQueue.push(row);
  if (eventQueue.length >= 50) flush(false);
}

function makeEventRow(eventType, detail){
  const d = detail || {};
  return {
    timestampIso: isoNow(),
    projectTag: CONFIG.projectTag,
    runMode,
    studyId: sessionRow.studyId,
    phase: sessionRow.phase,
    conditionGroup: sessionRow.conditionGroup,

    sessionId,
    eventType: safeStr(eventType),
    gameMode: safeStr(sessionRow.gameMode),
    diff: safeStr(sessionRow.diff),

    timeFromStartMs: safeNum(d.timeFromStartMs),
    targetId: safeStr(d.targetId),
    emoji: safeStr(d.emoji),
    itemType: safeStr(d.itemType),
    lane: safeStr(d.lane),

    rtMs: safeNum(d.rtMs),
    judgment: safeStr(d.judgment),
    totalScore: safeNum(d.totalScore),
    combo: safeNum(d.combo),
    isGood: (typeof d.isGood === 'boolean') ? d.isGood : null,

    feverState: safeStr(d.feverState),
    feverValue: safeNum(d.feverValue),

    goalProgress: safeNum(d.goalProgress),
    miniProgress: safeNum(d.miniProgress),

    extra: d.extra ? JSON.stringify(d.extra) : '',

    studentKey: safeStr(sessionRow.studentKey),
    schoolCode: safeStr(sessionRow.schoolCode),
    classRoom: safeStr(sessionRow.classRoom),
    studentNo: safeStr(sessionRow.studentNo),
    nickName: safeStr(sessionRow.nickName)
  };
}

function median(arr){
  if (!arr || !arr.length) return null;
  const a = arr.slice().sort((x,y)=>x-y);
  const mid = Math.floor(a.length/2);
  return (a.length%2) ? a[mid] : Math.round((a[mid-1]+a[mid])/2);
}

function avg(arr){
  if (!arr || !arr.length) return null;
  const s = arr.reduce((p,c)=>p+c,0);
  return Math.round(s / arr.length);
}

function bindOnce(){
  if (_BOUND) return;
  _BOUND = true;

  // ---------- listeners from all games ----------
  window.addEventListener('hha:spawn', (e)=>{
    const d = e.detail || {};

    // นับ spawn ใน sessionRow
    if (d.itemType === 'good' || d.itemType === 'gold') sessionRow.nTargetGoodSpawned++;
    else if (d.itemType === 'junk' || d.itemType === 'fake') sessionRow.nTargetJunkSpawned++;
    else if (d.itemType === 'star') sessionRow.nTargetStarSpawned++;
    else if (d.itemType === 'diamond') sessionRow.nTargetDiamondSpawned++;
    else if (d.itemType === 'shield') sessionRow.nTargetShieldSpawned++;

    pushEvent(makeEventRow('spawn', d));
  });

  window.addEventListener('hha:hit', (e)=>{
    const d = e.detail || {};

    if (d.itemType === 'good' || d.itemType === 'gold'){
      sessionRow.nHitGood++;
      if (typeof d.rtMs === 'number'){
        _rtGood.push(d.rtMs);
        if (d.rtMs <= FAST_RT_MS) _rtGoodFast++;
      }
    }
    if (d.itemType === 'junk' || d.itemType === 'fake') sessionRow.nHitJunk++;

    pushEvent(makeEventRow('hit', d));
  });

  window.addEventListener('hha:block', (e)=>{
    const d = e.detail || {};
    sessionRow.nHitJunkGuard++;
    pushEvent(makeEventRow('block', d));
  });

  window.addEventListener('hha:expire', (e)=>{
    const d = e.detail || {};
    if (d.itemType === 'good' || d.itemType === 'gold') sessionRow.nExpireGood++;
    pushEvent(makeEventRow('expire', d));
  });

  // ✅ เติม goals/minis ให้ทันก่อน end
  window.addEventListener('hha:questStats', (e)=>{
    const d = e.detail || {};
    if (d.goalsCleared != null) sessionRow.goalsCleared = safeNum(d.goalsCleared);
    if (d.goalsTotal   != null) sessionRow.goalsTotal   = safeNum(d.goalsTotal);
    if (d.miniCleared  != null) sessionRow.miniCleared  = safeNum(d.miniCleared);
    if (d.miniTotal    != null) sessionRow.miniTotal    = safeNum(d.miniTotal);
  });

  // hha:score (throttle) — เผื่อ debug/monitor
  window.addEventListener('hha:score', (e)=>{
    const t = Date.now();
    if (t - lastScoreLogAt < 500) return;
    lastScoreLogAt = t;

    pushEvent(makeEventRow('score', {
      ...((e && e.detail) || {}),
      timeFromStartMs: t - sessionStartMs,
      totalScore: (e.detail||{}).score,
      combo: (e.detail||{}).combo
    }));
  });

  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    pushEvent(makeEventRow('quest', {
      timeFromStartMs: Date.now() - sessionStartMs,
      goalProgress: safeNum(d.goal?.prog),
      miniProgress: safeNum(d.mini?.prog),
      extra: d
    }));
  });

  window.addEventListener('hha:end', (e)=>{
    const endTs = Date.now();
    const endIso = isoNow();
    const r = e.detail || {};

    sessionRow.endTimeIso = endIso;
    sessionRow.reason = safeStr(r.reason || '');

    // durationPlayedSec
    if (typeof r.durationSec === 'number' && typeof r.timeLeft === 'number' && r.durationSec > 0){
      sessionRow.durationPlayedSec = safeNum(r.durationSec - r.timeLeft);
    } else {
      sessionRow.durationPlayedSec = safeNum((endTs - sessionStartMs) / 1000);
    }

    sessionRow.scoreFinal = safeNum(r.scoreFinal);
    sessionRow.comboMax = safeNum(r.comboMax);
    sessionRow.misses = safeNum(r.misses);

    // ✅ ถ้า engine ส่ง stats มา -> เติมลง sessions
    if (r.stats){
      if (r.stats.goalsCleared != null) sessionRow.goalsCleared = safeNum(r.stats.goalsCleared);
      if (r.stats.goalsTotal   != null) sessionRow.goalsTotal   = safeNum(r.stats.goalsTotal);
      if (r.stats.miniCleared  != null) sessionRow.miniCleared  = safeNum(r.stats.miniCleared);
      if (r.stats.miniTotal    != null) sessionRow.miniTotal    = safeNum(r.stats.miniTotal);

      if (r.stats.accuracyGoodPct != null) sessionRow.accuracyGoodPct = safeNum(r.stats.accuracyGoodPct);
      if (r.stats.junkErrorPct    != null) sessionRow.junkErrorPct    = safeNum(r.stats.junkErrorPct);
      if (r.stats.avgRtGoodMs     != null) sessionRow.avgRtGoodMs     = safeNum(r.stats.avgRtGoodMs);
      if (r.stats.medianRtGoodMs  != null) sessionRow.medianRtGoodMs  = safeNum(r.stats.medianRtGoodMs);
      if (r.stats.fastHitRatePct  != null) sessionRow.fastHitRatePct  = safeNum(r.stats.fastHitRatePct);
    }

    // ✅ ถ้า engine ไม่ส่ง rt มาเลย -> คำนวณจาก rtGood ที่สะสมไว้
    if (sessionRow.avgRtGoodMs == null && _rtGood.length){
      sessionRow.avgRtGoodMs = avg(_rtGood);
      sessionRow.medianRtGoodMs = median(_rtGood);
      sessionRow.fastHitRatePct = Math.round((_rtGoodFast / Math.max(1, _rtGood.length)) * 100);
    }

    pushEvent(makeEventRow('end', {
      timeFromStartMs: endTs - sessionStartMs,
      totalScore: safeNum(r.scoreFinal),
      combo: safeNum(r.comboMax),
      extra: r
    }));

    flush(true);
  });
}

export function initCloudLogger(opts = {}){
  CONFIG = {
    endpoint: opts.endpoint || sessionStorage.getItem('HHA_LOG_ENDPOINT') || '',
    projectTag: opts.projectTag || 'HeroHealth',
    debug: !!opts.debug,
    gameVersion: opts.gameVersion || 'v0'
  };

  // reset per-session accumulators
  _rtGood = [];
  _rtGoodFast = 0;

  sessionId = uuid();
  sessionStartMs = Date.now();
  sessionStartIso = isoNow();
  runMode = (opts.runMode === 'research') ? 'research' : 'play';

  const profile = opts.profile || null;
  const prof = flattenProfile(profile);
  const meta = baseResearchMeta(opts.researchMeta || {});

  const planned =
    (opts.durationPlannedSec != null) ? opts.durationPlannedSec :
    (opts.durationSec != null) ? opts.durationSec :
    null;

  // --- sessions row (ให้ครบตามชีตของอาจารย์) ---
  sessionRow = {
    timestampIso: sessionStartIso,
    projectTag: CONFIG.projectTag,
    runMode,

    ...meta,

    sessionId,
    gameMode: safeStr(opts.mode || opts.gameMode || ''),
    diff: safeStr(opts.diff || ''),
    durationPlannedSec: safeNum(planned),
    durationPlayedSec: null,

    scoreFinal: null,
    comboMax: null,
    misses: null,
    goalsCleared: null,
    goalsTotal: null,
    miniCleared: null,
    miniTotal: null,

    // counters
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,
    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,
    accuracyGoodPct: null,
    junkErrorPct: null,
    avgRtGoodMs: null,
    medianRtGoodMs: null,
    fastHitRatePct: null,

    device: deviceLabel(),
    gameVersion: CONFIG.gameVersion,
    reason: '',

    startTimeIso: sessionStartIso,
    endTimeIso: '',

    // profile fields (flatten)
    studentKey: prof.studentKey,
    schoolCode: prof.schoolCode,
    schoolName: prof.schoolName,
    classRoom: prof.classRoom,
    studentNo: prof.studentNo,
    nickName: prof.nickName,
    gender: prof.gender,
    age: prof.age,
    gradeLevel: prof.gradeLevel,
    heightCm: prof.heightCm,
    weightKg: prof.weightKg,
    bmi: prof.bmi,
    bmiGroup: prof.bmiGroup,
    vrExperience: prof.vrExperience,
    gameFrequency: prof.gameFrequency,
    handedness: prof.handedness,
    visionIssue: prof.visionIssue,
    healthDetail: prof.healthDetail,
    consentParent: prof.consentParent,
    consentTeacher: prof.consentTeacher,
    profileSource: prof.profileSource,
    surveyKey: prof.surveyKey,
    excludeFlag: prof.excludeFlag,
    noteResearcher: prof.noteResearcher
  };

  // --- students-profile row (upsert server) ---
  if (prof.studentKey){
    profileRow = {
      timestampIso: isoNow(),
      projectTag: CONFIG.projectTag,
      runMode,
      studentKey: prof.studentKey,
      schoolCode: prof.schoolCode,
      schoolName: prof.schoolName,
      classRoom: prof.classRoom,
      studentNo: prof.studentNo,
      nickName: prof.nickName,
      gender: prof.gender,
      age: prof.age,
      gradeLevel: prof.gradeLevel,
      heightCm: prof.heightCm,
      weightKg: prof.weightKg,
      bmi: prof.bmi,
      bmiGroup: prof.bmiGroup,
      vrExperience: prof.vrExperience,
      gameFrequency: prof.gameFrequency,
      handedness: prof.handedness,
      visionIssue: prof.visionIssue,
      healthDetail: prof.healthDetail,
      consentParent: prof.consentParent,
      consentTeacher: prof.consentTeacher,
      createdAtIso: isoNow(),
      updatedAtIso: isoNow(),
      source: prof.profileSource || 'hub'
    };
  } else {
    profileRow = null;
  }

  bindOnce();
  emitLogger(true, 'logger: ready');

  // ส่ง start 1 event
  pushEvent(makeEventRow('start', { timeFromStartMs: 0, extra:{ startedAtIso: sessionStartIso }}));
  flush(false);
}

export function flushNow(){ flush(false); }
