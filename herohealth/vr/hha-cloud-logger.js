// === /herohealth/vr/hha-cloud-logger.js ===
// เก็บ log แบบ Session + Event แล้วส่งไป Google Apps Script (เลี่ยง CORS)

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

// ---------- public API ----------
export function initCloudLogger(opts = {}) {
  CONFIG = {
    endpoint:   opts.endpoint   || CONFIG.endpoint || '',
    projectTag: opts.projectTag || CONFIG.projectTag,
    debug:      !!opts.debug
  };

  if (!CONFIG.endpoint) {
    console.warn('[HHA Logger] endpoint ยังว่างอยู่ จะไม่ส่งข้อมูลขึ้น Google Sheet');
  }

  if (CONFIG.debug) {
    console.log('[HHA Logger] init', CONFIG);
  }
}

// ---------- internal helpers ----------
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
    // ไม่มี endpoint → ล้างคิวทิ้ง ป้องกัน error
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

  if (CONFIG.debug) {
    console.log('[HHA Logger] flush payload', payload);
  }

  // 1) ลองใช้ sendBeacon ก่อน (เหมาะกับตอนปิดหน้าเกม)
  let sent = false;
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyStr], { type: 'text/plain;charset=utf-8' });
      sent = navigator.sendBeacon(CONFIG.endpoint, blob);
    }
  } catch (err) {
    if (CONFIG.debug) console.warn('[HHA Logger] sendBeacon error', err);
  }
  if (sent) return;

  // 2) ถ้าใช้ sendBeacon ไม่ได้ → ใช้ fetch แบบ no-cors (จะไม่โดน preflight)
  try {
    fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      body: bodyStr,
      keepalive: true
      // **จงใจไม่ใส่ headers** เพื่อไม่ให้มี preflight CORS
    }).catch(err => {
      if (CONFIG.debug) console.warn('[HHA Logger] fetch(no-cors) error', err);
    });
  } catch (err) {
    if (CONFIG.debug) console.warn('[HHA Logger] fetch exception', err);
  }
}

// ---------- global event listeners ----------
window.addEventListener('hha:session', (e) => {
  const data = e.detail || {};
  sessionQueue.push(data);
  scheduleFlush();
});

window.addEventListener('hha:event', (e) => {
  const data = e.detail || {};
  eventQueue.push(data);
  scheduleFlush();
});
