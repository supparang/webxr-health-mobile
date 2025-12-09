// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health — Cloud Logger (Sessions + Events + Students Profile)
// ใช้กับ GoodJunkVR / GroupsVR / HydrationVR ฯลฯ
// - รองรับ studentKey + profile
// - Map field ให้ตรงหัวตารางใน Google Sheet
//
// ชีต: sessions / events / students-profile
//
// ใช้แบบ (จาก hub หรือหน้าเกม):
//   initCloudLogger({
//     endpoint: 'https://script.google.com/macros/s/XXXX/exec',
//     projectTag: 'HeroHealth-GoodJunkVR',
//     mode: 'GoodJunkVR',
//     diff: diff,
//     durationSec: dur,
//     debug: false,
//     studentKey: profile.studentKey,
//     profile: profile
//   });
//
// เกมยิง event:
//   window.dispatchEvent(new CustomEvent('hha:session', { detail: { ... } }));
//   window.dispatchEvent(new CustomEvent('hha:event',   { detail: { ... } }));
//
// NOTE: ควรเรียก initCloudLogger() ก่อนเริ่มเกมทุกครั้ง

'use strict';

// ---------- Config & State ----------
let CONFIG = {
  endpoint: '',
  projectTag: '',
  mode: '',
  diff: '',
  durationSec: 0,
  debug: false,
  studentKey: '',
  profile: null
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;
const FLUSH_DELAY = 2000; // ms

// นับ event ต่อ session (สำหรับ eventIndex)
const eventCounterBySession = new Map();

// ป้องกัน attach listener ซ้ำ
let listenersAttached = false;

// ---------- Helper ----------
function dbgLog(...args) {
  if (!CONFIG.debug) return;
  console.log('[HHA-Logger]', ...args);
}

function dbgWarn(...args) {
  if (!CONFIG.debug) return;
  console.warn('[HHA-Logger]', ...args);
}

function numOrEmpty(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

function computeAccuracy(goodHit, totalHit, accuracyPctRaw) {
  const accN = Number(accuracyPctRaw);
  if (Number.isFinite(accN)) return accN;

  const g = Number(goodHit);
  const t = Number(totalHit);
  if (Number.isFinite(g) && Number.isFinite(t) && t > 0) {
    return Math.round((g / t) * 1000) / 10; // 1 decimal
  }
  return '';
}

// ---------- Normalize: Session / Event (ฝั่งเว็บ) ----------
function normalizeSession(detail) {
  if (!detail) detail = {};

  const projectTag = detail.projectTag || CONFIG.projectTag || '';
  const studentKey = detail.studentKey || CONFIG.studentKey || '';
  const mode       = detail.mode || CONFIG.mode || '';
  const difficulty = detail.difficulty || CONFIG.diff || '';
  const durationPlannedSec =
    detail.durationPlannedSec ||
    CONFIG.durationSec ||
    '';

  const goodHit = numOrEmpty(detail.goodHit);
  const junkHit = numOrEmpty(detail.junkHit);
  let totalHit  = numOrEmpty(detail.totalHit);

  if (totalHit === '' && goodHit !== '' && junkHit !== '') {
    totalHit = goodHit + junkHit;
  }

  const accuracyPct = computeAccuracy(goodHit, totalHit, detail.accuracyPct);

  return {
    sessionId: detail.sessionId || '',
    studentKey,
    projectTag,
    mode,
    difficulty,
    durationPlannedSec,
    durationSecPlayed: numOrEmpty(detail.durationSecPlayed),
    startTimeIso: detail.startTimeIso || '',
    endTimeIso: detail.endTimeIso || '',
    device: detail.device || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    scoreFinal: numOrEmpty(detail.scoreFinal),
    comboMax: numOrEmpty(detail.comboMax),
    misses: numOrEmpty(detail.misses),
    totalHit,
    goodHit,
    junkHit,
    accuracyPct,
    feverCount: numOrEmpty(detail.feverCount),
    goalsCleared: numOrEmpty(
      detail.goalsCleared != null ? detail.goalsCleared : detail.goalsDone
    ),
    goalsTotal: numOrEmpty(
      detail.goalsTotal != null ? detail.goalsTotal : detail.goalsCount
    ),
    miniCleared: numOrEmpty(
      detail.miniCleared != null ? detail.miniCleared : detail.minisDone
    ),
    miniTotal: numOrEmpty(
      detail.miniTotal != null ? detail.miniTotal : detail.minisCount
    ),
    grade: detail.grade || '',
    gameVersion: detail.gameVersion || '',
    reason: detail.reason || ''
  };
}

function nextEventIndex(sessionIdRaw) {
  const sessionId = String(sessionIdRaw || '');
  if (!sessionId) return '';

  const prev = eventCounterBySession.get(sessionId) || 0;
  const next = prev + 1;
  eventCounterBySession.set(sessionId, next);
  return next;
}

function normalizeEvent(detail) {
  if (!detail) detail = {};

  const sessionId = detail.sessionId || '';
  const studentKey = detail.studentKey || CONFIG.studentKey || '';

  const idx = nextEventIndex(sessionId);
  const nowIso = new Date().toISOString();

  return {
    sessionId,
    studentKey,
    eventIndex: idx,
    eventTimeIso: nowIso,
    type: detail.type || '',
    emoji: detail.emoji || '',
    itemType: detail.itemType || '',
    lane: numOrEmpty(detail.lane),
    rtMs: numOrEmpty(detail.rtMs),
    totalScore: numOrEmpty(detail.totalScore),
    combo: numOrEmpty(detail.combo),
    isGood:
      typeof detail.isGood === 'boolean'
        ? detail.isGood
        : (detail.isGood === 'true' ? true :
           detail.isGood === 'false' ? false : '')
  };
}

// ---------- Queue & Flush ----------
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushNow('timer');
  }, FLUSH_DELAY);
}

export function flushNow(reason) {
  try {
    if (!CONFIG.endpoint) {
      dbgWarn('No endpoint configured, skip flush');
      sessionQueue = [];
      eventQueue = [];
      return;
    }

    if (!sessionQueue.length && !eventQueue.length && !CONFIG.profile) {
      dbgLog('Nothing to flush');
      return;
    }

    const payload = {
      projectTag: CONFIG.projectTag || '',
      studentKey: CONFIG.studentKey || '',
      profile: CONFIG.profile || null,
      sessions: sessionQueue.slice(),
      events: eventQueue.slice()
    };

    sessionQueue = [];
    eventQueue = [];

    dbgLog('Flushing to endpoint', CONFIG.endpoint, 'reason:', reason, payload);

    // ใช้ sendBeacon ถ้าได้ (เหมาะกับ beforeunload)
    if (typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function' &&
        reason === 'unload' &&
        !CONFIG.debug) {
      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });
        navigator.sendBeacon(CONFIG.endpoint, blob);
        return;
      } catch (err) {
        dbgWarn('sendBeacon failed, fallback to fetch', err);
      }
    }

    // ปกติใช้ fetch
    if (typeof fetch === 'function') {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      })
        .then(res => {
          dbgLog('Flush OK status', res.status);
        })
        .catch(err => {
          dbgWarn('Flush error', err);
        });
    } else {
      dbgWarn('No fetch/sendBeacon available, cannot send payload');
    }
  } catch (err) {
    dbgWarn('flushNow exception', err);
  }
}

// ---------- Public API: init + manual push ----------
export function initCloudLogger(opts = {}) {
  CONFIG = Object.assign(
    {
      endpoint: '',
      projectTag: '',
      mode: '',
      diff: '',
      durationSec: 0,
      debug: false,
      studentKey: '',
      profile: null
    },
    CONFIG,
    opts
  );

  dbgLog('initCloudLogger', CONFIG);

  if (!listenersAttached && typeof window !== 'undefined') {
    listenersAttached = true;

    // session summary จากเกม
    window.addEventListener('hha:session', (e) => {
      const detail = (e && e.detail) || {};
      const sess = normalizeSession(detail);
      sessionQueue.push(sess);
      scheduleFlush();
    });

    // per-event
    window.addEventListener('hha:event', (e) => {
      const detail = (e && e.detail) || {};
      const ev = normalizeEvent(detail);
      eventQueue.push(ev);
      scheduleFlush();
    });

    // กันกรณีปิดแท็บ/เปลี่ยนหน้า
    window.addEventListener('beforeunload', () => {
      flushNow('unload');
    });

    window.addEventListener('pagehide', () => {
      flushNow('unload');
    });
  }
}

// กรณีอยาก push เอง ไม่ใช้ customEvent
export function logSession(detail) {
  const sess = normalizeSession(detail || {});
  sessionQueue.push(sess);
  scheduleFlush();
}

export function logEvent(detail) {
  const ev = normalizeEvent(detail || {});
  eventQueue.push(ev);
  scheduleFlush();
}