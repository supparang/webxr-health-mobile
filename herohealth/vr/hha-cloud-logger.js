// === /herohealth/vr/hha-cloud-logger.js ===
// เก็บ log แบบ Session + Event แล้วส่งไป Google Apps Script

'use strict';

let CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbxunS2aJ3NlznqAtn2iTln0JsMJ2OdsYx6pVvfVDVn-CkQzDiSDh1tep3yJHnKa0VIH/exec',                 // ★★ ใส่ URL WebApp ของ Google Apps Script ตรงนี้ ★★
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
    // ไม่มี endpoint → ไม่ส่งอะไร ป้องกัน error CORS/405
    sessionQueue.length = 0;
    eventQueue.length   = 0;
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, FLUSH_DELAY);
}

async function flushNow() {
  flushTimer = null;

  if (!CONFIG.endpoint) return;
  if (!sessionQueue.length && !eventQueue.length) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    sessions:   sessionQueue.slice(),
    events:     eventQueue.slice()
  };

  if (CONFIG.debug) {
    console.log('[HHA Logger] flush payload', payload);
  }

  sessionQueue.length = 0;
  eventQueue.length   = 0;

  try {
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    if (CONFIG.debug) {
      console.log('[HHA Logger] send OK', await res.text());
    }
  } catch (err) {
    if (CONFIG.debug) {
      console.error('[HHA Logger] send error', err);
    }
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
