// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health Research Logger (CORS-friendly for GitHub Pages -> Google Apps Script)
// Schema: sessions / events / students-profile
// - sendBeacon first, fallback fetch(no-cors)
// - CORS-friendly: send as text/plain;charset=utf-8 to reduce preflight
// - collects: sessions[1], events[*], studentsProfile[0..1] (upsert on server)
// - emits: hha:logger { ok:boolean, msg:string }

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
let flushInFlight = false;

// prevent double bind
if (typeof window !== 'undefined' && window.__HHA_LOGGER_BOUND__) {
  // already bound in this page
} else if (typeof window !== 'undefined') {
  window.__HHA_LOGGER_BOUND__ = true;
}

function isoNow(){ return new Date().toISOString(); }
function uuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}

function emitLogger(ok, msg){
  try{
    window.dispatchEvent(new CustomEvent('hha:logger', { detail:{ ok, msg } }));
  }catch(_){}
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
  // จำกัด event กัน payload ใหญ่
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

/**
 * CORS-friendly send:
 * - prefer sendBeacon with text/plain blob
 * - fallback fetch no-cors with Content-Type text/plain;charset=utf-8
 * Why: Apps Script + GitHub Pages often fails on application/json preflight.
 */
async function send(payload){
  if (!CONFIG.endpoint) throw new Error('No endpoint');

  // IMPORTANT: send as text/plain to reduce preflight/CORS issues
  const body = JSON.stringify(payload);

  // 1) sendBeacon (best-effort)
  if (navigator.sendBeacon){
    try{
      const ok = navigator.sendBeacon(
        CONFIG.endpoint,
        new Blob([body], { type:'text/plain;charset=utf-8' })
      );
      if (ok){
        emitLogger(true, payload.final ? 'logger: sent(final/beacon)' : 'logger: sent(beacon)');
        return true;
      }
    }catch(err){
      // ignore and fallback
      if (CONFIG.debug) console.warn('[HHA Logger] beacon error', err);
    }
  }

  // 2) fetch fallback (no-cors)
  await fetch(CONFIG.endpoint, {
    method:'POST',
    mode:'no-cors',
    keepalive: true,
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body
  });

  emitLogger(true, payload.final ? 'logger: sent(final/no-cors)' : 'logger: sent(no-cors)');
  return true;
}

function flush(final=false){
  if (!sessionId) return;
  if (!final && eventQueue.length === 0) return;
  if (flushInFlight) return;

  const payload = packPayload(final);
  flushInFlight = true;

  send(payload).catch(err=>{
    emitLogger(false, 'logger: send failed (check console)');
    console.warn('[HHA Logger] send failed', err);
  }).finally(()=>{
    flushInFlight = false;
    // ถ้ายังมี event ค้างมาก ๆ ให้ยิงต่อทันทีแบบเบา ๆ
    if (eventQueue.length >= 200) {
      setTimeout(()=>flush(false), 10);
    }
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

export function initCloudLogger(opts = {}){
  CONFIG = {
    endpoint: opts.endpoint || sessionStorage.getItem('HHA_LOG_ENDPOINT') || '',
    projectTag: opts.projectTag || 'HeroHealth',
    debug: !!opts.debug,
    gameVersion: opts.gameVersion || 'v0'
  };

  sessionId = uuid();
  sessionStartMs = Date.now();
  sessionStartIso = isoNow();
  runMode = (opts.runMode === 'research') ? 'research' : 'play';

  const profile = opts.profile || null;
  const prof = flattenProfile(profile);
  const meta = baseResearchMeta(opts.researchMeta || {});

  // --- sessions row ---
  sessionRow = {
    timestampIso: sessionStartIso,
    projectTag: CONFIG.projectTag,
    runMode,

    ...meta,

    sessionId,
    gameMode: safeStr(opts.mode || opts.gameMode || ''),
    diff: safeStr(opts.diff || ''),
    durationPlannedSec: safeNum(opts.durationPlannedSec),
    durationPlayedSec: null,

    scoreFinal: null,
    comboMax: null,
    misses: null,
    goalsCleared: null,
    goalsTotal: null,
    miniCleared: null,
    miniTotal: null,

    // counters — engines เติมผ่าน event
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

    // profile fields
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

  emitLogger(true, 'logger: ready');

  // ---------- listeners from all games ----------
  window.addEventListener('hha:spawn', (e)=>{
    const d = e.detail || {};
    if (d.itemType === 'good') sessionRow.nTargetGoodSpawned++;
    else if (d.itemType === 'junk') sessionRow.nTargetJunkSpawned++;
    else if (d.itemType === 'star') sessionRow.nTargetStarSpawned++;
    else if (d.itemType === 'diamond') sessionRow.nTargetDiamondSpawned++;
    else if (d.itemType === 'shield') sessionRow.nTargetShieldSpawned++;

    pushEvent(makeEventRow('spawn', d));
  });

  window.addEventListener('hha:hit', (e)=>{
    const d = e.detail || {};
    if (d.itemType === 'good' || d.itemType === 'gold') sessionRow.nHitGood++;
    if (d.itemType === 'junk') sessionRow.nHitJunk++;

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

  // hha:score (throttle) — เผื่อ debug/monitor
  window.addEventListener('hha:score', (e)=>{
    const t = Date.now();
    if (t - lastScoreLogAt < 500) return;
    lastScoreLogAt = t;

    const det = (e && e.detail) || {};
    pushEvent(makeEventRow('score', {
      ...det,
      timeFromStartMs: t - sessionStartMs,
      totalScore: det.score,
      combo: det.combo
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

    if (typeof r.durationSec === 'number' && typeof r.timeLeft === 'number' && r.durationSec > 0){
      sessionRow.durationPlayedSec = safeNum(r.durationSec - r.timeLeft);
    } else {
      sessionRow.durationPlayedSec = safeNum((endTs - sessionStartMs) / 1000);
    }

    sessionRow.scoreFinal = safeNum(r.scoreFinal);
    sessionRow.comboMax   = safeNum(r.comboMax);
    sessionRow.misses     = safeNum(r.misses);

    if (r.stats){
      sessionRow.goalsCleared = safeNum(r.stats.goalsCleared);
      sessionRow.goalsTotal   = safeNum(r.stats.goalsTotal);
      sessionRow.miniCleared  = safeNum(r.stats.miniCleared);
      sessionRow.miniTotal    = safeNum(r.stats.miniTotal);

      if (r.stats.accuracyGoodPct != null) sessionRow.accuracyGoodPct = safeNum(r.stats.accuracyGoodPct);
      if (r.stats.junkErrorPct != null) sessionRow.junkErrorPct = safeNum(r.stats.junkErrorPct);
      if (r.stats.avgRtGoodMs != null) sessionRow.avgRtGoodMs = safeNum(r.stats.avgRtGoodMs);
      if (r.stats.medianRtGoodMs != null) sessionRow.medianRtGoodMs = safeNum(r.stats.medianRtGoodMs);
      if (r.stats.fastHitRatePct != null) sessionRow.fastHitRatePct = safeNum(r.stats.fastHitRatePct);
    }

    pushEvent(makeEventRow('end', {
      timeFromStartMs: endTs - sessionStartMs,
      totalScore: safeNum(r.scoreFinal),
      combo: safeNum(r.comboMax),
      extra: r
    }));

    flush(true);
  });

  // ส่ง start 1 event
  pushEvent(makeEventRow('start', {
    timeFromStartMs: 0,
    extra:{ startedAtIso: sessionStartIso }
  }));

  flush(false);

  // optional: flush on visibility/pagehide (best effort)
  window.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', ()=>{
    flush(true);
  });
}

export function flushNow(){ flush(false); }
