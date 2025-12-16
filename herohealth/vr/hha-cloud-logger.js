// === /herohealth/vr/hha-cloud-logger.js ===
// Cloud Logger (Sessions + Events + Profile + AdaptiveStats) for Hero Health VR
// รองรับ 2 โหมด: play / research (runMode)
// payload ไป Google Apps Script:
//  {
//    projectTag,
//    runMode,
//    sessions: [ ... ],
//    events:   [ ... ],
//    profiles: [ ... ],
//    adaptiveStats: [ ... ]
//  }

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  mode: '',          // GoodJunkVR / HydrationVR / FoodGroupsVR
  runMode: 'play',   // play | research
  diff: '',
  durationSec: 60,
  debug: false,

  // ===== meta งานวิจัย / site =====
  studyId: '',
  phase: '',
  conditionGroup: '',
  sessionOrder: '',
  blockLabel: '',
  siteCode: '',
  schoolYear: '',
  semester: ''
};

let sessionQueue  = [];
let eventQueue    = [];
let profileQueue  = [];
let adaptiveQueue = [];   // ✅ NEW

let profileQueued = false;

let flushTimer    = null;
const FLUSH_DELAY = 2500;

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function ssGet(key, fallback = '') {
  try {
    if (typeof sessionStorage === 'undefined') return fallback;
    const v = sessionStorage.getItem(key);
    return v != null ? v : fallback;
  } catch {
    return fallback;
  }
}

function readProfileFromStorage() {
  try {
    const rawProf    = ssGet('HHA_STUDENT_PROFILE', '');
    const studentKey = ssGet('HHA_STUDENT_KEY', '');
    if (!rawProf) return null;
    const prof = JSON.parse(rawProf);
    return Object.assign({}, prof, { studentKey });
  } catch (err) {
    console.warn('[HHA-Logger] readProfile error', err);
    return null;
  }
}

// --------------------------------------------------
// Profile (research only)
// --------------------------------------------------
function queueProfileIfNeeded() {
  if (profileQueued) return;
  if (CONFIG.runMode !== 'research') return;

  const prof = readProfileFromStorage();
  if (!prof || !prof.studentKey) return;

  const nowIso = new Date().toISOString();

  profileQueue.push({
    projectTag:  CONFIG.projectTag,
    runMode:     CONFIG.runMode,
    studyId:     prof.studyId || CONFIG.studyId || '',
    siteCode:    prof.siteCode || CONFIG.siteCode || '',
    schoolYear:  prof.schoolYear || CONFIG.schoolYear || '',
    semester:    prof.semester || CONFIG.semester || '',

    studentKey:  prof.studentKey || '',
    schoolCode:  prof.schoolCode || '',
    schoolName:  prof.schoolName || '',
    classRoom:   prof.classRoom || '',
    studentNo:   prof.studentNo || '',
    nickName:    prof.nickName || '',
    gender:      prof.gender || '',
    age:         prof.age || '',
    gradeLevel:  prof.gradeLevel || '',
    heightCm:    prof.heightCm || '',
    weightKg:    prof.weightKg || '',
    bmi:         prof.bmi ?? '',
    bmiGroup:    prof.bmiGroup || '',

    vrExperience:  prof.vrExperience || '',
    gameFrequency: prof.gameFrequency || '',
    handedness:    prof.handedness || '',
    visionIssue:   prof.visionIssue || '',
    healthDetail:  prof.healthDetail || '',

    consentParent:  prof.consentParent || '',
    consentTeacher: prof.consentTeacher || '',

    createdAtIso: prof.createdAt || nowIso,
    updatedAtIso: prof.updatedAt || nowIso,
    source:       prof.source || 'VR-Nutrition-Hub',

    surveyKey:      prof.surveyKey || '',
    excludeFlag:    prof.excludeFlag || '',
    noteResearcher: prof.noteResearcher || ''
  });

  profileQueued = true;
}

// --------------------------------------------------
// Flush
// --------------------------------------------------
function scheduleFlush(delay) {
  if (!CONFIG.endpoint) {
    if (CONFIG.debug) console.warn('[HHA-Logger] endpoint not set');
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(doFlush, delay || FLUSH_DELAY);
}

async function doFlush() {
  flushTimer = null;
  if (!CONFIG.endpoint) return;
  if (!sessionQueue.length && !eventQueue.length && !profileQueue.length && !adaptiveQueue.length) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    runMode:    CONFIG.runMode,
    sessions:   sessionQueue,
    events:     eventQueue,
    profiles:   profileQueue,
    adaptiveStats: adaptiveQueue
  };

  if (CONFIG.debug) console.log('[HHA-Logger] FLUSH →', payload);

  const bSessions = sessionQueue.slice();
  const bEvents   = eventQueue.slice();
  const bProfiles = profileQueue.slice();
  const bAdaptive = adaptiveQueue.slice();

  sessionQueue = [];
  eventQueue   = [];
  profileQueue = [];
  adaptiveQueue = [];

  try {
    await fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('[HHA-Logger] flush error', err);
    sessionQueue  = bSessions.concat(sessionQueue);
    eventQueue    = bEvents.concat(eventQueue);
    profileQueue  = bProfiles.concat(profileQueue);
    adaptiveQueue = bAdaptive.concat(adaptiveQueue);
  }
}

// --------------------------------------------------
// Session events
// --------------------------------------------------
function onSessionEvent(ev) {
  const d = ev.detail || {};
  const nowIso = new Date().toISOString();
  const prof = readProfileFromStorage() || {};

  sessionQueue.push({
    timestampIso: nowIso,
    projectTag: CONFIG.projectTag,
    runMode: CONFIG.runMode,

    studyId: d.studyId || CONFIG.studyId || prof.studyId || '',
    phase: d.phase || CONFIG.phase || '',
    conditionGroup: d.conditionGroup || CONFIG.conditionGroup || '',
    sessionOrder: d.sessionOrder ?? CONFIG.sessionOrder ?? '',
    blockLabel: d.blockLabel || CONFIG.blockLabel || '',
    siteCode: prof.siteCode || CONFIG.siteCode || '',
    schoolYear: prof.schoolYear || CONFIG.schoolYear || '',
    semester: prof.semester || CONFIG.semester || '',

    sessionId: d.sessionId || '',
    gameMode: d.mode || CONFIG.mode || '',
    diff: d.difficulty || CONFIG.diff || '',
    durationPlannedSec: CONFIG.durationSec,

    durationPlayedSec: d.durationSecPlayed ?? '',
    scoreFinal: d.scoreFinal ?? d.score ?? '',
    comboMax: d.comboMax ?? '',
    misses: d.misses ?? '',
    goalsCleared: d.goalsCleared ?? '',
    goalsTotal: d.goalsTotal ?? '',
    miniCleared: d.miniCleared ?? '',
    miniTotal: d.miniTotal ?? '',

    nTargetGoodSpawned: d.nTargetGoodSpawned ?? '',
    nTargetJunkSpawned: d.nTargetJunkSpawned ?? '',
    nTargetStarSpawned: d.nTargetStarSpawned ?? '',
    nTargetDiamondSpawned: d.nTargetDiamondSpawned ?? '',
    nTargetShieldSpawned: d.nTargetShieldSpawned ?? '',

    nHitGood: d.nHitGood ?? '',
    nHitJunk: d.nHitJunk ?? '',
    nHitJunkGuard: d.nHitJunkGuard ?? '',
    nExpireGood: d.nExpireGood ?? '',

    accuracyGoodPct: d.accuracyGoodPct ?? '',
    junkErrorPct: d.junkErrorPct ?? '',
    avgRtGoodMs: d.avgRtGoodMs ?? '',
    medianRtGoodMs: d.medianRtGoodMs ?? '',

    device: d.device || navigator.userAgent || '',
    gameVersion: d.gameVersion || '',
    reason: d.reason || '',
    startTimeIso: d.startTimeIso || '',
    endTimeIso: d.endTimeIso || '',

    studentKey: prof.studentKey || ''
  });

  scheduleFlush();
}

// --------------------------------------------------
// Game events (hit / miss / expire)
// --------------------------------------------------
function onGameEvent(ev) {
  const d = ev.detail || {};
  const nowIso = new Date().toISOString();
  const prof = readProfileFromStorage() || {};

  eventQueue.push({
    timestampIso: nowIso,
    projectTag: CONFIG.projectTag,
    runMode: CONFIG.runMode,

    studyId: d.studyId || CONFIG.studyId || prof.studyId || '',
    phase: d.phase || CONFIG.phase || '',
    conditionGroup: d.conditionGroup || CONFIG.conditionGroup || '',

    sessionId: d.sessionId || '',
    eventType: d.type || '',
    gameMode: d.mode || CONFIG.mode || '',
    diff: d.difficulty || CONFIG.diff || '',

    timeFromStartMs: d.timeFromStartMs ?? '',
    emoji: d.emoji || '',
    judgment: (d.judgment || '').toUpperCase() || '',
    rtMs: d.rtMs ?? '',
    totalScore: d.totalScore ?? '',
    combo: d.combo ?? '',
    isGood: typeof d.isGood === 'boolean' ? d.isGood : '',

    studentKey: prof.studentKey || ''
  });

  scheduleFlush();
}

// --------------------------------------------------
// Adaptive stats  ✅ ฟัง hha:adaptive
// --------------------------------------------------
function onAdaptiveStat(ev) {
  if (CONFIG.runMode !== 'play') return;

  const d = ev.detail || {};
  const nowIso = new Date().toISOString();
  const prof = readProfileFromStorage() || {};

  adaptiveQueue.push({
    timestampIso: nowIso,
    projectTag: CONFIG.projectTag,
    runMode: CONFIG.runMode,

    studyId: d.studyId || CONFIG.studyId || prof.studyId || '',
    phase: d.phase || CONFIG.phase || '',
    conditionGroup: d.conditionGroup || CONFIG.conditionGroup || '',

    sessionId: d.sessionId || '',
    gameMode: d.mode || CONFIG.mode || '',
    diff: d.difficulty || CONFIG.diff || '',

    adaptiveScale: d.adaptiveScale ?? d.scale ?? '',
    adaptiveSpawn: d.adaptiveSpawn ?? d.spawnInterval ?? '',
    adaptiveMaxActive: d.adaptiveMaxActive ?? d.maxActive ?? '',
    level: d.level ?? '',

    studentKey: prof.studentKey || ''
  });

  scheduleFlush();
}

// --------------------------------------------------
// Public API
// --------------------------------------------------
export function initCloudLogger(opts = {}) {
  CONFIG.endpoint    = opts.endpoint || CONFIG.endpoint || '';
  CONFIG.projectTag  = opts.projectTag || CONFIG.projectTag || 'HeroHealth';
  CONFIG.mode        = opts.mode || CONFIG.mode || '';
  CONFIG.runMode     = opts.runMode || ssGet('HHA_RUN_MODE', 'play');
  CONFIG.diff        = opts.diff || CONFIG.diff || '';
  CONFIG.durationSec = Number(opts.durationSec || CONFIG.durationSec || 60);
  CONFIG.debug       = !!opts.debug;

  CONFIG.studyId        = opts.studyId || CONFIG.studyId || ssGet('HHA_STUDY_ID', '');
  CONFIG.phase          = opts.phase || CONFIG.phase || ssGet('HHA_PHASE', '');
  CONFIG.conditionGroup = opts.conditionGroup || CONFIG.conditionGroup || ssGet('HHA_CONDITION', '');
  CONFIG.sessionOrder   = opts.sessionOrder || CONFIG.sessionOrder || ssGet('HHA_SESSION_ORDER', '');
  CONFIG.blockLabel     = opts.blockLabel || CONFIG.blockLabel || ssGet('HHA_BLOCK_LABEL', '');
  CONFIG.siteCode       = opts.siteCode || CONFIG.siteCode || ssGet('HHA_SITE_CODE', '');
  CONFIG.schoolYear     = opts.schoolYear || CONFIG.schoolYear || ssGet('HHA_SCHOOL_YEAR', '');
  CONFIG.semester       = opts.semester || CONFIG.semester || ssGet('HHA_SEMESTER', '');

  if (CONFIG.debug) console.log('[HHA-Logger] init', CONFIG);

  if (!window.__HHA_LOGGER_BOUND__) {
    window.__HHA_LOGGER_BOUND__ = true;
    window.addEventListener('hha:session', onSessionEvent);
    window.addEventListener('hha:event', onGameEvent);
    window.addEventListener('hha:adaptive', onAdaptiveStat); // ✅ สำคัญ
    window.addEventListener('hha:stat', onAdaptiveStat);     // เผื่อใช้ในอนาคต
  }

  queueProfileIfNeeded();
  if (profileQueued) scheduleFlush(800);
}
