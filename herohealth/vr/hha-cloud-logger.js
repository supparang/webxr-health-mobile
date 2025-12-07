// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health — Cloud Logger (VR)
// เก็บ log แบบ Session + Event แล้วส่งไป Google Apps Script (เลี่ยง CORS)
//
// Apps Script คาดหวัง payload แบบ:
//   {
//     projectTag: 'HeroHealth-GoodJunkVR',
//     sessions: [ { sessionId, playerId, mode, difficulty, ... } ],
//     events:   [ { sessionId, type, emoji, lane, rtMs, totalScore, combo, isGood, itemType, ... } ]
//   }

'use strict';

let CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbxunS2aJ3NlznqAtn2iTln0JsMJ2OdsYx6pVvfVDVn-CkQzDiSDh1tep3yJHnKa0VIH/exec',
  projectTag: 'HeroHealth-GoodJunkVR',
  debug: false
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;
const FLUSH_DELAY = 2000; // ms

// ---------- state ของ session ปัจจุบัน (จาก GoodJunkVR / Hydration / Groups) ----------
let currentSessionId   = null;
let currentMeta        = null;
let sessionStartedAt   = null;
let sessionEnded       = false;

/* ---------- debug helper ---------- */
function logDebug(...args) {
  if (!CONFIG.debug) return;
  console.log('[HHA Logger]', ...args);
}

/* ---------- payload + flush ---------- */
function buildPayload() {
  if (!sessionQueue.length && !eventQueue.length) return null;
  return {
    projectTag: CONFIG.projectTag,
    sessions:   sessionQueue.splice(0),
    events:     eventQueue.splice(0)
  };
}

function scheduleFlush() {
  if (!CONFIG.endpoint) {
    sessionQueue.length = 0;
    eventQueue.length   = 0;
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, FLUSH_DELAY);
}

function flushNow() {
  flushTimer = null;
  if (!CONFIG.endpoint) return;

  const payload = buildPayload();
  if (!payload) return;

  const bodyStr = JSON.stringify(payload);
  logDebug('flush payload', payload);

  // 1) พยายามใช้ sendBeacon ก่อน (เหมาะกับตอนปิดแท็บ)
  let sent = false;
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyStr], { type: 'text/plain;charset=utf-8' });
      sent = navigator.sendBeacon(CONFIG.endpoint, blob);
    }
  } catch (err) {
    logDebug('sendBeacon error', err);
  }
  if (sent) return;

  // 2) ถ้าใช้ sendBeacon ไม่ได้ → ใช้ fetch แบบ no-cors ไม่ใส่ headers เลี่ยง preflight
  try {
    fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      body: bodyStr,
      keepalive: true
      // ไม่ใส่ headers เพื่อไม่ให้มี preflight
    }).catch(err => {
      logDebug('fetch(no-cors) error', err);
    });
  } catch (err) {
    logDebug('fetch exception', err);
  }
}

/* ---------- API ที่หน้าเกมเรียก ---------- */
export function initCloudLogger(opts = {}) {
  CONFIG = {
    endpoint:   opts.endpoint   || CONFIG.endpoint || '',
    projectTag: opts.projectTag || CONFIG.projectTag,
    debug:      !!opts.debug
  };

  if (!CONFIG.endpoint) {
    console.warn('[HHA Logger] endpoint ยังว่างอยู่ จะไม่ส่งข้อมูลขึ้น Google Sheet');
  }

  // สร้าง session ใหม่สำหรับรอบนี้
  currentSessionId = 'sess-' + Date.now().toString(36) + '-' +
    Math.random().toString(36).slice(2, 7);
  sessionStartedAt = new Date();
  sessionEnded     = false;

  currentMeta = {
    playerId:   opts.playerId || '',
    mode:       opts.mode || 'GoodJunkVR',
    difficulty: (opts.diff || opts.difficulty || 'normal').toLowerCase(),
    device:     navigator.userAgent || '',
    durationSec: opts.durationSec || null,
    gameVersion: opts.gameVersion || ''
  };

  logDebug('initCloudLogger', CONFIG, { currentSessionId, currentMeta });

  // บันทึก event เปิด session
  eventQueue.push({
    sessionId:  currentSessionId,
    type:       'session_start',
    emoji:      '',
    lane:       '',
    rtMs:       '',
    totalScore: '',
    combo:      '',
    isGood:     '',
    itemType:   '',
    meta:       currentMeta
  });
  scheduleFlush();
}

/**
 * เผื่ออยากจบ session เอง (โดยไม่รอ hha:end)
 */
export function endCloudSession(reason = '') {
  if (sessionEnded) return;
  sessionEnded = true;

  eventQueue.push({
    sessionId:  currentSessionId,
    type:       'session_end',
    emoji:      '',
    lane:       '',
    rtMs:       '',
    totalScore: '',
    combo:      '',
    isGood:     '',
    itemType:   '',
    reason
  });
  scheduleFlush();
}

/* ---------- ตัวแปลง event จากเกม → รูปแบบ EventLog ---------- */

// hha:score → บันทึกคะแนนรวม + combo ปัจจุบัน
function onScoreEvent(e) {
  const d = e.detail || {};
  const ev = {
    sessionId:  currentSessionId,
    type:       'score',
    emoji:      '',
    lane:       '',
    rtMs:       '',
    totalScore: d.score ?? '',
    combo:      d.combo ?? '',
    isGood:     '',
    itemType:   ''
  };
  eventQueue.push(ev);
  scheduleFlush();
}

// hha:miss → บันทึกว่า miss 1 ครั้ง
function onMissEvent(/* e */) {
  const ev = {
    sessionId:  currentSessionId,
    type:       'miss',
    emoji:      '',
    lane:       '',
    rtMs:       '',
    totalScore: '',
    combo:      '',
    isGood:     '',
    itemType:   ''
  };
  eventQueue.push(ev);
  scheduleFlush();
}

// hha:end → สรุป session ลง SessionLog + event "end"
function onEndEvent(e) {
  const d = e.detail || {};
  if (!currentSessionId) return;

  const endedAt = new Date();
  sessionEnded  = true;

  const durationPlayed =
    d.durationSec ??
    currentMeta.durationSec ??
    '';

  const sess = {
    sessionId:        currentSessionId,
    playerId:         currentMeta.playerId,
    mode:             d.mode || currentMeta.mode || '',
    difficulty:       (d.diff || currentMeta.difficulty || 'normal'),
    device:           currentMeta.device,
    startTimeIso:     sessionStartedAt ? sessionStartedAt.toISOString() : '',
    endTimeIso:       endedAt.toISOString(),
    durationSecPlayed: durationPlayed,
    scoreFinal:       d.scoreFinal ?? d.score ?? 0,
    comboMax:         d.comboMax ?? 0,
    misses:           d.misses ?? 0,
    gameVersion:      currentMeta.gameVersion,
    reason:           d.reason || ''
  };

  sessionQueue.push(sess);

  const ev = {
    sessionId:  currentSessionId,
    type:       'end',
    emoji:      '',
    lane:       '',
    rtMs:       '',
    totalScore: sess.scoreFinal,
    combo:      sess.comboMax,
    isGood:     '',
    itemType:   ''
  };
  eventQueue.push(ev);

  logDebug('session summary', sess);
  scheduleFlush();
}

/* ---------- รองรับ event แบบเก่า: hha:session / hha:event ---------- */
// ถ้าเกมอื่นยิง hha:session / hha:event มาโดยตรง จะยังทำงานได้
function onLegacySession(e) {
  const data = e.detail || {};
  // ควรส่ง object ที่มี field ตาม Apps Script ต้องการ
  sessionQueue.push(data);
  scheduleFlush();
}

function onLegacyEvent(e) {
  const data = e.detail || {};
  eventQueue.push(data);
  scheduleFlush();
}

/* ---------- ติด global listeners แค่ครั้งเดียว ---------- */
window.addEventListener('hha:score',  onScoreEvent);
window.addEventListener('hha:miss',   onMissEvent);
window.addEventListener('hha:end',    onEndEvent);

// legacy
window.addEventListener('hha:session', onLegacySession);
window.addEventListener('hha:event',   onLegacyEvent);
