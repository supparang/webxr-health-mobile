// === /herohealth/vr/hha-cloud-logger.js ===
'use strict';

let CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbxunS2aJ3NlznqAtn2iTln0JsMJ2OdsYx6pVvfVDVn-CkQzDiSDh1tep3yJHnKa0VIH/exec',
  projectTag: 'HeroHealth-GoodJunkVR',
  debug: false
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;
const FLUSH_DELAY = 2000;

export function initCloudLogger(opts = {}) {
  CONFIG = {
    endpoint:   opts.endpoint   || CONFIG.endpoint || '',
    projectTag: opts.projectTag || CONFIG.projectTag,
    debug:      !!opts.debug
  };
  if (!CONFIG.endpoint) {
    console.warn('[HHA Logger] endpoint ยังว่างอยู่ จะไม่ส่งข้อมูลขึ้น Google Sheet');
  }
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

function buildPayload() {
  if (!sessionQueue.length && !eventQueue.length) return null;
  return {
    projectTag: CONFIG.projectTag,
    sessions:   sessionQueue.splice(0),
    events:     eventQueue.splice(0)
  };
}

function flushNow() {
  flushTimer = null;
  if (!CONFIG.endpoint) return;

  const payload = buildPayload();
  if (!payload) return;

  const bodyStr = JSON.stringify(payload);

  // 1) sendBeacon ก่อน
  let sent = false;
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyStr], { type: 'text/plain;charset=utf-8' });
      sent = navigator.sendBeacon(CONFIG.endpoint, blob);
    }
  } catch (_) {}
  if (sent) return;

  // 2) fallback fetch(no-cors)
  try {
    fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      body: bodyStr,
      keepalive: true
    }).catch(()=>{});
  } catch (_) {}
}

// session summary
window.addEventListener('hha:session', (e) => {
  sessionQueue.push(e.detail || {});
  scheduleFlush();
});

// per-event
window.addEventListener('hha:event', (e) => {
  eventQueue.push(e.detail || {});
  scheduleFlush();
});
