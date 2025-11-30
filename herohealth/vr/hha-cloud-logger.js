// === /herohealth/vr/hha-cloud-logger.js (GoodJunkVR v3) ===
// เก็บ log แบบ Session + Event แล้วส่งไป Google Apps Script
// payload:
//   {
//     projectTag: 'HeroHealth-GoodJunkVR',
//     sessions: [ { ... } ],
//     events:   [ { ... } ]
//   }

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
    // ★ ใส่ default endpoint ของ WebApp ของคุณไว้ตรงนี้แล้ว ★
    endpoint: (opts.endpoint || 'https://script.google.com/macros/s/AKfycbxNor4osZ3NI_pGtYd8hGlwyMRTF9J2I4kCFiHUO-G_4VBj2ZqtTXiqsFU8KWDqRSTQ/exec').trim(),
    projectTag: opts.projectTag || 'HeroHealth-GoodJunkVR',
    debug: !!opts.debug
  };

  if (!CONFIG.endpoint) {
    console.warn('[HHA-Logger] no endpoint configured');
    return;
  }

  // ฟัง event จาก GameEngine
  window.addEventListener('hha:session', (e) => {
    const s = (e && e.detail) || {};
    sessionQueue.push(s);
    if (CONFIG.debug) console.log('[HHA-Logger] queue session', s);
    scheduleFlush();
  });

  window.addEventListener('hha:event', (e) => {
    const ev = (e && e.detail) || {};
    eventQueue.push(ev);
    if (CONFIG.debug) console.log('[HHA-Logger] queue event', ev);
    scheduleFlush();
  });

  // ปิดแท็บ → พยายามส่งรอบสุดท้าย
  window.addEventListener('beforeunload', () => {
    if (!sessionQueue.length && !eventQueue.length) return;
    trySendBeacon(true);
  });

  if (CONFIG.debug) {
    console.log('[HHA-Logger] initCloudLogger', CONFIG);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY);
}

function flush() {
  if (!CONFIG.endpoint) return;
  if (!sessionQueue.length && !eventQueue.length) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    sessions: sessionQueue.splice(0),
    events:   eventQueue.splice(0)
  };

  if (CONFIG.debug) {
    console.log('[HHA-Logger] flush →', payload);
  }

  // 1) ใช้ sendBeacon ก่อน
  if (trySendBeacon(false, payload)) return;

  // 2) fallback เป็น fetch no-cors
  try {
    const body = JSON.stringify(payload);

    fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body
    }).then(() => {
      if (CONFIG.debug) console.log('[HHA-Logger] sent payload (fetch no-cors)');
    }).catch(err => {
      if (CONFIG.debug) console.error('[HHA-Logger] fetch error', err);
    });
  } catch (err) {
    if (CONFIG.debug) console.error('[HHA-Logger] outer error', err);
  }
}

function trySendBeacon(force, payload) {
  if (!navigator.sendBeacon) return false;

  const data = payload || {
    projectTag: CONFIG.projectTag,
    sessions: sessionQueue.splice(0),
    events:   eventQueue.splice(0)
  };

  if (!data.sessions.length && !data.events.length && !force) {
    return false;
  }

  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    const ok = navigator.sendBeacon(CONFIG.endpoint, blob);
    if (CONFIG.debug) console.log('[HHA-Logger] sendBeacon', ok, data);
    return ok;
  } catch (err) {
    if (CONFIG.debug) console.warn('[HHA-Logger] sendBeacon error → fallback fetch', err);
    return false;
  }
}

export default { initCloudLogger };
