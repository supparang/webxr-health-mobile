// === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
// Hero Health — Cloud logger (Sessions + Events → Google Sheet)

let config = {
  endpoint: '',
  projectTag: 'HeroHealth',
  debug: false,
  batchMs: 3000
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;

export function initCloudLogger(opts = {}) {
  config = { ...config, ...opts };

  if (!config.endpoint) {
    console.warn('[HHA-Logger] No endpoint configured, logging disabled.');
    return;
  }

  // ฟังสัญญาณจาก GameEngine
  window.addEventListener('hha:session', onSession);
  window.addEventListener('hha:event',   onEvent);

  if (config.debug) {
    console.log('[HHA-Logger] Initialized', config);
  }
}

function onSession(ev) {
  const row = (ev && ev.detail) || {};
  sessionQueue.push({
    sheet:   'sessions',           // ชีตสรุปครั้งเล่น
    project: config.projectTag,
    ...row
  });
  scheduleFlush();
}

function onEvent(ev) {
  const row = (ev && ev.detail) || {};
  eventQueue.push({
    sheet:   'events',             // ชีต log ราย event
    project: config.projectTag,
    ...row
  });
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, config.batchMs);
}

async function flush() {
  if (!config.endpoint) return;
  flushTimer = null;

  if (!sessionQueue.length && !eventQueue.length) return;

  const payload = {
    project:  config.projectTag,
    sessions: sessionQueue.splice(0),
    events:   eventQueue.splice(0)
  };

  try {
    if (config.debug) console.log('[HHA-Logger] sending', payload);

    await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors' // ให้ Apps Script รับได้แม้ไม่ตั้ง CORS
    });

    if (config.debug) console.log('[HHA-Logger] sent payload');
  } catch (err) {
    if (config.debug) console.warn('[HHA-Logger] error', err);
  }
}
