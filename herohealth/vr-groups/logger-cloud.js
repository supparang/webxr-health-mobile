// vr-groups/logger-cloud.js
'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth-GroupsVR',
  debug: false
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;
const FLUSH_DELAY = 2000; // ms

export function initCloudLogger(opts = {}) {
  CONFIG = {
    endpoint: (opts.endpoint || 'https://script.google.com/macros/s/AKfycbzEW94iBXISShedudnv-vE0k0_gDkiGtU8r2yatyr_sj4l8dRDhgxgjU6rGyyv0Yh7p/exec').trim(),
    projectTag: opts.projectTag || 'HeroHealth-GroupsVR',
    debug: !!opts.debug
  };

  if (!CONFIG.endpoint) {
    console.warn('[GroupsVR-Logger] no endpoint configured');
    return;
  }

  window.addEventListener('hha:session', (e) => {
    const s = (e && e.detail) || {};
    sessionQueue.push(s);
    if (CONFIG.debug) console.log('[GroupsVR-Logger] queue session', s);
    scheduleFlush();
  });

  window.addEventListener('hha:event', (e) => {
    const ev = (e && e.detail) || {};
    eventQueue.push(ev);
    if (CONFIG.debug) console.log('[GroupsVR-Logger] queue event', ev);
    scheduleFlush();
  });

  window.addEventListener('beforeunload', () => {
    if (!sessionQueue.length && !eventQueue.length) return;
    trySendBeacon(true);
  });

  if (CONFIG.debug) console.log('[GroupsVR-Logger] init', CONFIG);
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

  if (CONFIG.debug) console.log('[GroupsVR-Logger] flush →', payload);

  // 1) ลองใช้ sendBeacon ก่อน
  if (trySendBeacon(false, payload)) return;

  // 2) ถ้าไม่ได้ ค่อย fallback เป็น fetch no-cors
  try {
    const body = JSON.stringify(payload);
    fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors', // ⬅ สำคัญสุด: no-cors
      keepalive: true,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // ⬅ เลี่ยง preflight
      },
      body
    }).then(() => {
      if (CONFIG.debug) console.log('[GroupsVR-Logger] sent via fetch no-cors');
    }).catch(err => {
      if (CONFIG.debug) console.error('[GroupsVR-Logger] fetch error', err);
    });
  } catch (err) {
    if (CONFIG.debug) console.error('[GroupsVR-Logger] outer error', err);
  }
}

function trySendBeacon(force, payload) {
  if (!navigator.sendBeacon) return false;

  const data = payload || {
    projectTag: CONFIG.projectTag,
    sessions: sessionQueue.splice(0),
    events:   eventQueue.splice(0)
  };

  if (!data.sessions.length && !data.events.length && !force) return false;

  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    const ok = navigator.sendBeacon(CONFIG.endpoint, blob);
    if (CONFIG.debug) console.log('[GroupsVR-Logger] sendBeacon', ok, data);
    return ok;
  } catch (err) {
    if (CONFIG.debug) console.warn('[GroupsVR-Logger] sendBeacon error', err);
    return false;
  }
}

export default { initCloudLogger };
