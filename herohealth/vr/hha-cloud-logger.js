// === /herohealth/vr/hha-cloud-logger.js ===
// Cloud Logger (Sessions + Events + Profile) for Hero Health VR
// รองรับ 2 โหมด: play / research  (runMode)
// payload ไป Google Apps Script:
//  {
//    projectTag: 'HeroHealth-GoodJunkVR',
//    runMode: 'play' | 'research',
//    sessions: [ { ... } ],
//    events:   [ { ... } ],
//    profiles: [ { ... } ]   // ส่งโปรไฟล์นักเรียน 1 แถว (research mode เท่านั้น)
//  }

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  mode: '',
  runMode: 'play',      // play | research
  diff: '',
  durationSec: 60,
  debug: false
};

let sessionQueue  = [];
let eventQueue    = [];
let profileQueue  = [];
let profileQueued = false;

let flushTimer    = null;
const FLUSH_DELAY = 2500; // ms

// ===== Helper: อ่าน profile จาก sessionStorage =====
function readProfileFromStorage() {
  try {
    const rawProf = sessionStorage.getItem('HHA_STUDENT_PROFILE');
    const studentKey = sessionStorage.getItem('HHA_STUDENT_KEY') || '';
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
    projectTag: CONFIG.projectTag,
    runMode: CONFIG.runMode,
    studentKey: prof.studentKey || '',
    schoolCode: prof.schoolCode || '',
    schoolName: prof.schoolName || '',
    classRoom:  prof.classRoom || '',
    studentNo:  prof.studentNo || '',
    nickName:   prof.nickName || '',
    gender:     prof.gender || '',
    age:        prof.age || '',
    gradeLevel: prof.gradeLevel || '',
    heightCm:   prof.heightCm || '',
    weightKg:   prof.weightKg || '',
    bmi:        prof.bmi ?? '',
    bmiGroup:   prof.bmiGroup || '',
    vrExperience:  prof.vrExperience || '',
    gameFrequency: prof.gameFrequency || '',
    handedness:    prof.handedness || '',
    visionIssue:   prof.visionIssue || '',
    healthDetail:  prof.healthDetail || '',
    consentParent: prof.consentParent || '',
    consentTeacher: prof.consentTeacher || '',
    createdAtIso: prof.createdAt || nowIso,
    updatedAtIso: prof.updatedAt || nowIso,
    source: prof.source || 'VR-Nutrition-Hub'
  });

  profileQueued = true;
}

// ===== Queue + Flush =====
function scheduleFlush(delay) {
  if (!CONFIG.endpoint) {
    if (CONFIG.debug) {
      console.warn('[HHA-Logger] endpoint not set, skip flush');
    }
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(doFlush, delay || FLUSH_DELAY);
}

async function doFlush() {
  flushTimer = null;
  if (!CONFIG.endpoint) return;

  if (!sessionQueue.length && !eventQueue.length && !profileQueue.length) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    runMode: CONFIG.runMode,
    sessions: sessionQueue,
    events: eventQueue,
    profiles: profileQueue
  };

  if (CONFIG.debug) {
    console.log('[HHA-Logger] FLUSH →', payload);
  }

  // copy ไว้เผื่อส่งไม่สำเร็จจะไม่หาย
  const backupSessions = sessionQueue.slice();
  const backupEvents   = eventQueue.slice();
  const backupProfiles = profileQueue.slice();

  // เตรียมเคลียร์ก่อน แล้วถ้าส่ง fail ค่อย restore
  sessionQueue = [];
  eventQueue   = [];
  profileQueue = [];   // profileQueued ยังเป็น true ไม่ต้อง push ซ้ำ

  try {
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors', // ปลอดภัยสุดสำหรับ Apps Script
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (CONFIG.debug) {
      console.log('[HHA-Logger] flush sent', res);
    }
  } catch (err) {
    console.error('[HHA-Logger] flush error', err);
    // restore queues เผื่อรอบถัดไป
    sessionQueue = backupSessions.concat(sessionQueue);
    eventQueue   = backupEvents.concat(eventQueue);
    profileQueue = backupProfiles.concat(profileQueue);
  }
}

// ===== Event Handlers =====
function onSessionEvent(ev) {
  const d = ev.detail || {};
  const nowIso = new Date().toISOString();

  const prof = readProfileFromStorage() || {};

  const row = {
    timestampIso: nowIso,
    projectTag: CONFIG.projectTag,
    runMode: CONFIG.runMode,

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

    device: d.device || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    gameVersion: d.gameVersion || '',
    reason: d.reason || '',
    startTimeIso: d.startTimeIso || d.startTime || '',
    endTimeIso: d.endTimeIso || d.endTime || '',

    studentKey: prof.studentKey || '',
    schoolCode: prof.schoolCode || '',
    schoolName: prof.schoolName || '',
    classRoom:  prof.classRoom || '',
    studentNo:  prof.studentNo || '',
    nickName:   prof.nickName || '',
    gender:     prof.gender || '',
    age:        prof.age || '',
    gradeLevel: prof.gradeLevel || '',
    heightCm:   prof.heightCm || '',
    weightKg:   prof.weightKg || '',
    bmi:        prof.bmi ?? '',
    bmiGroup:   prof.bmiGroup || '',
    vrExperience:  prof.vrExperience || '',
    gameFrequency: prof.gameFrequency || '',
    handedness:    prof.handedness || '',
    visionIssue:   prof.visionIssue || '',
    healthDetail:  prof.healthDetail || '',
    consentParent: prof.consentParent || '',
    consentTeacher: prof.consentTeacher || '',
    profileSource: prof.source || 'VR-Nutrition-Hub'
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
    projectTag: CONFIG.projectTag,
    runMode: CONFIG.runMode,

    sessionId: d.sessionId || '',
    eventType: d.type || '',
    gameMode: d.mode || CONFIG.mode || '',
    diff: d.difficulty || CONFIG.diff || '',
    emoji: d.emoji || '',
    itemType: d.itemType || '',
    lane: d.lane ?? '',
    rtMs: d.rtMs ?? '',
    totalScore: d.totalScore ?? '',
    combo: d.combo ?? '',
    isGood: typeof d.isGood === 'boolean' ? d.isGood : '',
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

// ===== Public API =====
export function initCloudLogger(opts = {}) {
  CONFIG.endpoint    = opts.endpoint || CONFIG.endpoint || '';
  CONFIG.projectTag  = opts.projectTag || CONFIG.projectTag || 'HeroHealth';
  CONFIG.mode        = opts.mode || CONFIG.mode || '';
  CONFIG.runMode     =
    opts.runMode ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('HHA_RUN_MODE')) ||
    'play';
  CONFIG.diff        = opts.diff || CONFIG.diff || '';
  CONFIG.durationSec = Number(opts.durationSec || CONFIG.durationSec || 60);
  CONFIG.debug       = !!opts.debug;

  if (CONFIG.debug) {
    console.log('[HHA-Logger] init', CONFIG);
  }

  // bind event listener แค่ครั้งเดียว
  if (!window.__HHA_LOGGER_BOUND__) {
    window.__HHA_LOGGER_BOUND__ = true;
    window.addEventListener('hha:session', onSessionEvent);
    window.addEventListener('hha:event', onGameEvent);
  }

  // ถ้าเป็น research mode → queue โปรไฟล์ + flush
  queueProfileIfNeeded();
  if (profileQueued) scheduleFlush(800);
}