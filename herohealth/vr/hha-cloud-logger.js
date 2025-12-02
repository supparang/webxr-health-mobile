// === /herohealth/vr/hha-cloud-logger.js ===
// เก็บ log แบบ Session + Event แล้วส่งไป Google Apps Script
// payload:
//   {
//     projectTag: 'HeroHealth-GoodJunkVR',
//     sessions: [ { ... } ],
//     events:   [ { ... } ]
//   }

'use strict';

let CONFIG = {
  // ★★ ใส่ URL WebApp ของ Google Apps Script ตรงนี้ ( /exec ) ★★
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

function scheduleFlush() {
  if (!CONFIG.endpoint) {
    // ไม่มี endpoint → เคลียร์คิวทิ้ง ป้องกัน error
    sessionQueue.length = 0;
    eventQueue.length   = 0;
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, FLUSH_DELAY);
}

function buildPayload() {
  if (!sessionQueue.length && !eventQueue.length) return null;

  const payload = {
    projectTag: CONFIG.projectTag,
    sessions:   sessionQueue.splice(0),
    events:     eventQueue.splice(0)
  };
  return payload;
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

  // 1) พยายามใช้ sendBeacon ก่อน (simple request → ไม่โดน CORS/preflight)
  let sent = false;
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyStr], { type: 'text/plain;charset=utf-8' });
      sent = navigator.sendBeacon(CONFIG.endpoint, blob);
      if (CONFIG.debug) console.log('[HHA Logger] sendBeacon sent=', sent);
    }
  } catch (err) {
    if (CONFIG.debug) console.warn('[HHA Logger] sendBeacon error', err);
  }
  if (sent) return;

  // 2) ถ้าใช้ sendBeacon ไม่ได้ → fallback เป็น fetch แบบ no-cors
  try {
    fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',           // ไม่อ่าน response แต่ไม่เด้ง CORS error
      // ไม่ตั้ง header พิเศษเลย → browser ใช้ text/plain simple request
      body: bodyStr,
      keepalive: true
    }).catch(err => {
      if (CONFIG.debug) console.warn('[HHA Logger] fetch error', err);
    });
    if (CONFIG.debug) console.log('[HHA Logger] fetch(no-cors) fired');
  } catch (err) {
    if (CONFIG.debug) console.warn('[HHA Logger] fetch throw', err);
  }
}

// ---------- global event listeners ----------
// session summary จาก GameEngine.finishSession()
window.addEventListener('hha:session', (e) => {
  const data = e.detail || {};
  sessionQueue.push(data);
  scheduleFlush();
});

// event ต่อครั้งจาก GameEngine (hit / miss / timeout ฯลฯ)
window.addEventListener('hha:event', (e) => {
  const data = e.detail || {};
  eventQueue.push(data);
  scheduleFlush();
});
