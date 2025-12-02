// === /herohealth/vr/hha-cloud-logger.js ===
// เก็บ log แบบ Session + Event แล้วส่งไป Google Apps Script
// payload ตัวอย่าง:
// {
//   projectTag: 'HeroHealth-GoodJunkVR',
//   sessions: [ { ... } ],
//   events:   [ { ... } ]
// }

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth-GoodJunkVR',
  debug: false
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;
const FLUSH_DELAY = 2000; // ms

// เรียกจาก goodjunk-vr.html
export function initCloudLogger(opts = {}) {
  CONFIG = {
    // ★ ใส่ WebApp URL ของ Google Apps Script ตรงนี้ ★
    endpoint: opts.endpoint || 'https://script.google.com/macros/s/PUT_YOUR_SCRIPT_ID_HERE/exec',
    projectTag: opts.projectTag || 'HeroHealth-GoodJunkVR',
    debug: !!opts.debug
  };

  // ฟัง session summary จาก GameEngine
  window.addEventListener('hha:session', (e) => {
    const data = e.detail || {};
    sessionQueue.push(data);
    if (CONFIG.debug) console.log('[HHA CloudLogger] session', data);
    scheduleFlush();
  });

  // ฟัง event ราย hit / miss / timeout ฯลฯ
  window.addEventListener('hha:event', (e) => {
    const data = e.detail || {};
    eventQueue.push(data);
    if (CONFIG.debug) console.log('[HHA CloudLogger] event', data);
    scheduleFlush();
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow();
  }, FLUSH_DELAY);
}

async function flushNow() {
  if (!CONFIG.endpoint) {
    if (CONFIG.debug) console.warn('[HHA CloudLogger] ไม่มี endpoint');
    return;
  }
  if (!sessionQueue.length && !eventQueue.length) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    sessions: sessionQueue.slice(),
    events:   eventQueue.slice()
  };

  // เคลียร์คิวชั่วคราว
  sessionQueue.length = 0;
  eventQueue.length   = 0;

  try {
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    if (CONFIG.debug) console.log('[HHA CloudLogger] ส่งสำเร็จ', payload);
  } catch (err) {
    // ถ้าส่ง fail เอากลับเข้า queue ไว้ flush รอบหน้า
    sessionQueue.unshift(...payload.sessions);
    eventQueue.unshift(...payload.events);
    if (CONFIG.debug) console.warn('[HHA CloudLogger] send error', err);
  }
}

// export default เผื่ออนาคตจะ import แบบ default
export default { initCloudLogger };
