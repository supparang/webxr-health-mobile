// === /herohealth/vr/hha-cloud-logger.js ===
// Cloud Logger (Sessions + Events + Profile + AdaptiveStats) for Hero Health VR
// รองรับ 2 โหมด: play / research (runMode)
//
// payload ไป Google Apps Script:
//  {
//    projectTag: 'HeroHealth-<Game>',
//    runMode: 'play' | 'research',
//    sessions: [ { ... } ],
//    events:   [ { ... } ],
//    profiles: [ { ... } ],
//    adaptiveStats: [ { ... } ]   // ✅ เพิ่มแล้ว
//  }

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  mode: '',          // gameMode เช่น GoodJunkVR / HydrationVR / PlateVR / FoodGroupsVR
  runMode: 'play',   // play | research
  diff: '',
  durationSec: 60,
  debug: false,

  // ===== meta งานวิจัย / site =====
  studyId: '',
  phase: '',             // pre / post / followup ฯลฯ
  conditionGroup: '',    // control / VR-only / VR+Coach ...
  sessionOrder: '',      // ลำดับที่เล่นในวันนั้น 1,2,3,...
  blockLabel: '',        // label block (ถ้ามี)
  siteCode: '',          // รหัสโรงเรียน/ศูนย์
  schoolYear: '',        // ปีการศึกษา
  semester: ''           // ภาคเรียน
};

let sessionQueue   = [];
let eventQueue     = [];
let profileQueue   = [];
let adaptiveQueue  = [];   // ✅ NEW

let profileQueued  = false;
let flushTimer     = null;
const FLUSH_DELAY  = 2500; // ms

// ===== Helper: อ่านจาก sessionStorage แบบ safe =====
function ssGet(key, fallback = '') {
  try {
    if (typeof sessionStorage === 'undefined') return fallback;
    const v = sessionStorage.getItem(key);
    return v != null ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

// ===== Helper: อ่าน profile จาก sessionStorage =====
function readProfileFromStorage() {
  try {
    const rawProf    = ssGet('HHA_STUDENT_PROFILE', '');
    const studentKey = ssGet('HHA_STUDENT_KEY', '');
    if (!rawProf) return null;

    const prof = JSON.parse(rawProf);
    return Object.assign({}, prof, { studentKey });
  } catch (err) {
    console.warn('[HHA-Logger] readProfileFromStorage error', err);
    return null;
  }
}

// push profile เข้า queue แค่ครั้งเดียวต่อ page load (เฉพาะ research mode)
function queueProfileIfNeeded() {
  if (profileQueued) return;
  if (CONFIG.runMode !== 'research') return;

  const prof = readProfileFromStorage();
  if (!prof || !prof.studentKey) return;

  const nowIso = new Date().toISOString();

  profileQueue.push({
    projectTag:   CONFIG.projectTag,
    runMode:      CONFIG.runMode,
    studyId:      prof.studyId || CONFIG.studyId || '',
    siteCode:     prof.siteCode || CONFIG.siteCode || '',
    schoolYear:   prof.schoolYear || CONFIG.schoolYear || '',
    semester:     prof.semester || CONFIG.semester || '',

    studentKey:   prof.studentKey || '',
    schoolCode:   prof.schoolCode || '',
    schoolName:   prof.schoolName || '',
    classRoom:    prof.classRoom || '',
    studentNo:    prof.studentNo || '',
    nickName:     prof.nickName || '',
    gender:       prof.gender || '',
    age:          prof.age || '',
    gradeLevel:   prof.gradeLevel || '',
    heightCm:     prof.heightCm || '',
    weightKg:     prof.weightKg || '',
    bmi:          prof.bmi ?? '',
    bmiGroup:     prof.bmiGroup || '',

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

// ===== Queue + Flush =====
function scheduleFlush(delay) {
  if (!CONFIG.endpoint) {
    if (CONFIG.debug) console.warn('[HHA-Logger] endpoint not set, skip flush');
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
    projectTag:     CONFIG.projectTag,
    runMode:        CONFIG.runMode,
    sessions:       sessionQueue,
    events:         eventQueue,
    profiles:       profileQueue,
    adaptiveStats:  adaptiveQueue   // ✅ NEW
  };

  if (CONFIG.debug) console.log('[HHA-Logger] FLUSH →', payload);

  // backup
  const backupSessions  = sessionQueue.slice();
  const backupEvents    = eventQueue.slice();
  const backupProfiles  = profileQueue.slice();
  const backupAdaptive  = adaptiveQueue.slice();

  // clear first (fail -> restore)
  sessionQueue  = [];
  eventQueue    = [];
  profileQueue  = []; // profileQueued ยัง true ไม่ต้อง push ซ้ำ
  adaptiveQueue = [];

  try {
    await fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (CONFIG.debug) console.log('[HHA-Logger] flush sent');
  } catch (err) {
    console.error('[HHA-Logger] flush error', err);
    // restore
    sessionQueue  = backupSessions.concat(sessionQueue);
    eventQueue    = backupEvents.concat(eventQueue);
    profileQueue  = backupProfiles.concat(profileQueue);
    adaptiveQueue = backupAdaptive.concat(adaptiveQueue);
  }
}

// ===== Event Handlers =====
function onSessionEvent(ev) {
  const d = ev.detail || {};
  const nowIso = new Date().toISOString();
  const prof = readProfileFromStorage() || {};

  const studyId        = d.studyId || CONFIG.studyId || prof.studyId || '';
  const phase          = d.phase || CONFIG.phase || '';
  const conditionGroup = d.conditionGroup || CONFIG.conditionGroup || '';
  const sessionOrder   = d.sessionOrder ?? CONFIG.sessionOrder ?? '';
  const blockLabel     = d.blockLabel || CONFIG.blockLabel || '';
  const siteCode       = prof.siteCode || CONFIG.siteCode || '';

  const schoolYear     = prof.schoolYear || CONFIG.schoolYear || '';
  const semester       = prof.semester || CONFIG.semester || '';

  const row = {
    timestampIso: nowIso,
    projectTag:   CONFIG.projectTag,
    runMode:      CONFIG.runMode,

    studyId,
    phase,
    conditionGroup,
    sessionOrder,
    blockLabel,
    siteCode,
    schoolYear,
    semester,

    sessionId: d.sessionId || '',
    gameMode:  d.mode || CONFIG.mode || '',
    diff:      d.difficulty || d.diff || CONFIG.diff || '',
    durationPlannedSec: CONFIG.durationSec,

    durationPlayedSec: d.durationSecPlayed ?? '',
    scoreFinal: d.scoreFinal ?? d.score ?? '',
    comboMax:   d.comboMax ?? '',
    misses:     d.misses ?? '',
    goalsCleared: d.goalsCleared ?? '',
    goalsTotal:   d.goalsTotal ?? '',
    miniCleared:  d.miniCleared ?? '',
    miniTotal:    d.miniTotal ?? '',

    nTargetGoodSpawned:    d.nTargetGoodSpawned ?? '',
    nTargetJunkSpawned:    d.nTargetJunkSpawned ?? '',
    nTargetStarSpawned:    d.nTargetStarSpawned ?? '',
    nTargetDiamondSpawned: d.nTargetDiamondSpawned ?? '',
    nTargetShieldSpawned:  d.nTargetShieldSpawned ?? '',

    nHitGood:       d.nHitGood ?? '',
    nHitJunk:       d.nHitJunk ?? '',
    nHitJunkGuard:  d.nHitJunkGuard ?? '',
    nExpireGood:    d.nExpireGood ?? '',

    accuracyGoodPct: d.accuracyGoodPct ?? '',
    junkErrorPct:    d.junkErrorPct ?? '',

    avgRtGoodMs:     d.avgRtGoodMs ?? '',
    medianRtGoodMs:  d.medianRtGoodMs ?? '',
    fastHitRatePct:  d.fastHitRatePct ?? '',

    device:      d.device || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    gameVersion: d.gameVersion || '',
    reason:      d.reason || '',
    startTimeIso: d.startTimeIso || d.startTime || '',
    endTimeIso:   d.endTimeIso   || d.endTime   || '',

    // join profile
    studentKey: prof.studentKey || '',
    schoolCode: prof.schoolCode || '',
    schoolName: prof.schoolName || '',
    classRoom:  prof.classRoom  || '',
    studentNo:  prof.studentNo  || '',
    nickName:   prof.nickName   || '',

    gender:     prof.gender     || '',
    age:        prof.age        || '',
    gradeLevel: prof.gradeLevel || '',
    heightCm:   prof.heightCm   || '',
    weightKg:   prof.weightKg   || '',
    bmi:        prof.bmi ?? '',
    bmiGroup:   prof.bmiGroup || '',

    vrExperience:  prof.vrExperience || '',
    gameFrequency: prof.gameFrequency || '',
    handedness:    prof.handedness || '',
    visionIssue:   prof.visionIssue || '',
    healthDetail:  prof.healthDetail || '',
    consentParent: prof.consentParent || '',
    consentTeacher: prof.consentTeacher || '',
    profileSource: prof.source || 'VR-Nutrition-Hub',

    surveyKey:      prof.surveyKey || '',
    excludeFlag:    prof.excludeFlag || '',
    noteResearcher: prof.noteResearcher || ''
  };

  sessionQueue.push(row);
  scheduleFlush();
}

function onGameEvent(ev) {
  const d = ev.detail || {};
  const nowIso = new Date().toISOString();
  const prof = readProfileFromStorage() || {};

  const row = {
    timestampIso: nowIso,
    projectTag:   CONFIG.projectTag,
    runMode:      CONFIG.runMode,

    studyId: d.studyId || CONFIG.studyId || prof.studyId || '',
    phase:   d.phase   || CONFIG.phase || '',
    conditionGroup: d.conditionGroup || CONFIG.conditionGroup || '',

    sessionId: d.sessionId || '',
    eventType: d.type || d.eventType || '',
    gameMode:  d.mode || CONFIG.mode || '',
    diff:      d.difficulty || d.diff || CONFIG.diff || '',

    timeFromStartMs: d.timeFromStartMs ?? '',
    targetId:        d.targetId ?? '',

    emoji:    d.emoji || '',
    itemType: d.itemType || '',
    lane:     d.lane ?? '',
    rtMs:     d.rtMs ?? '',

    judgment: (d.judgment || '').toString().toUpperCase() || '',

    totalScore: d.totalScore ?? '',
    combo:      d.combo ?? '',
    isGood: (typeof d.isGood === 'boolean') ? d.isGood : '',

    feverState: d.feverState || '',
    feverValue: d.feverValue ?? '',
    goalProgress: d.goalProgress ?? '',
    miniProgress: d.miniProgress ?? '',

    extra: d.extra || '',

    studentKey: prof.studentKey || '',
    schoolCode: prof.schoolCode || '',
    classRoom:  prof.classRoom || '',
    studentNo:  prof.studentNo || '',
    nickName:   prof.nickName || ''
  };

  eventQueue.push(row);
  scheduleFlush();
}

// ✅ NEW: Adaptive stats (play only)
function onAdaptiveStat(ev) {
  const d = ev.detail || {};
  const nowIso = new Date().toISOString();
  const prof = readProfileFromStorage() || {};

  // กรองให้ชัวร์: play เท่านั้น
  const rm = String(d.runMode || CONFIG.runMode || 'play').toLowerCase();
  if (rm !== 'play') return;

  const row = {
    timestampIso: nowIso,
    projectTag:   CONFIG.projectTag,
    runMode:      'play',

    studyId: d.studyId || CONFIG.studyId || prof.studyId || '',
    phase:   d.phase   || CONFIG.phase || '',
    conditionGroup: d.conditionGroup || CONFIG.conditionGroup || '',

    sessionId: d.sessionId || '',
    mode:      d.mode || CONFIG.mode || '',
    diff:      d.difficulty || d.diff || CONFIG.diff || '',

    adaptiveScale:    d.adaptiveScale ?? '',
    adaptiveSpawn:    d.adaptiveSpawn ?? '',
    adaptiveMaxActive:d.adaptiveMaxActive ?? '',

    score:  d.score ?? '',
    combo:  d.combo ?? '',
    misses: d.misses ?? '',
    timeFromStartMs: d.timeFromStartMs ?? '',
    reason: d.reason || '',

    // join profile
    studentKey: prof.studentKey || '',
    schoolCode: prof.schoolCode || '',
    classRoom:  prof.classRoom || '',
    studentNo:  prof.studentNo || '',
    nickName:   prof.nickName || ''
  };

  adaptiveQueue.push(row);
  scheduleFlush();
}

// ===== Public API =====
export function initCloudLogger(opts = {}) {
  CONFIG.endpoint    = opts.endpoint || CONFIG.endpoint || '';
  CONFIG.projectTag  = opts.projectTag || CONFIG.projectTag || 'HeroHealth';
  CONFIG.mode        = opts.mode      || CONFIG.mode || '';
  CONFIG.runMode     = (opts.runMode || ssGet('HHA_RUN_MODE', 'play')).toLowerCase() === 'research'
    ? 'research' : 'play';
  CONFIG.diff        = opts.diff || CONFIG.diff || '';
  CONFIG.durationSec = Number(opts.durationSec || CONFIG.durationSec || 60);
  CONFIG.debug       = !!opts.debug;

  // meta งานวิจัย
  CONFIG.studyId        = opts.studyId        || CONFIG.studyId        || ssGet('HHA_STUDY_ID', '');
  CONFIG.phase          = opts.phase          || CONFIG.phase          || ssGet('HHA_PHASE', '');
  CONFIG.conditionGroup = opts.conditionGroup || CONFIG.conditionGroup || ssGet('HHA_CONDITION', '');
  CONFIG.sessionOrder   = opts.sessionOrder   || CONFIG.sessionOrder   || ssGet('HHA_SESSION_ORDER', '');
  CONFIG.blockLabel     = opts.blockLabel     || CONFIG.blockLabel     || ssGet('HHA_BLOCK_LABEL', '');
  CONFIG.siteCode       = opts.siteCode       || CONFIG.siteCode       || ssGet('HHA_SITE_CODE', '');
  CONFIG.schoolYear     = opts.schoolYear     || CONFIG.schoolYear     || ssGet('HHA_SCHOOL_YEAR', '');
  CONFIG.semester       = opts.semester       || CONFIG.semester       || ssGet('HHA_SEMESTER', '');

  if (CONFIG.debug) console.log('[HHA-Logger] init', CONFIG);

  // bind event listener แค่ครั้งเดียว
  if (!window.__HHA_LOGGER_BOUND__) {
    window.__HHA_LOGGER_BOUND__ = true;
    window.addEventListener('hha:session', onSessionEvent);
    window.addEventListener('hha:event',   onGameEvent);
    window.addEventListener('hha:stat',    onAdaptiveStat); // ✅ NEW
  }

  // research mode → queue โปรไฟล์ + flush
  queueProfileIfNeeded();
  if (profileQueued) scheduleFlush(800);
}
