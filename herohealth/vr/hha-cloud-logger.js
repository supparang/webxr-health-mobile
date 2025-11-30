// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health — Cloud Logger (Google Apps Script / Google Sheets)

let CFG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  debug: false,
  flushDelayMs: 2500,  // หน่วงรวม event 2.5 วินาทีค่อยยิงทีเดียว
};

let queueSessions = [];
let queueEvents   = [];
let flushTimer    = null;

export function initCloudLogger(opts = {}) {
  CFG = {
    ...CFG,
    endpoint:   opts.endpoint   || CFG.endpoint,
    projectTag: opts.projectTag || CFG.projectTag,
    debug:      !!opts.debug,
    flushDelayMs: opts.flushDelayMs || CFG.flushDelayMs
  };

  if (!CFG.endpoint) {
    console.warn('[HHA-Logger] Missing endpoint (Google Apps Script URL)');
    return;
  }

  if (CFG.debug) {
    console.log('[HHA-Logger] init', CFG);
  }

  // ฟัง session summary
  window.addEventListener('hha:session', (e) => {
    const s = (e && e.detail) || {};
    if (!s || !s.sessionId) return;
    queueSessions.push({
      project:   CFG.projectTag,
      ts:        new Date().toISOString(),
      ...s
    });
    if (CFG.debug) console.log('[HHA-Logger] queue session', s.sessionId);
    scheduleFlush();
  });

  // ฟัง event ระดับ hit / spawn / quest ฯลฯ
  window.addEventListener('hha:event', (e) => {
    const d = (e && e.detail) || {};
    queueEvents.push({
      project: CFG.projectTag,
      ts:      new Date().toISOString(),
      ...d
    });
    if (CFG.debug) console.log('[HHA-Logger] queue event', d.kind || 'unknown');
    scheduleFlush();
  });

  // เผื่อจบเกมแล้วยังมี queue ค้างอยู่
  window.addEventListener('hha:end', () => {
    if (CFG.debug) console.log('[HHA-Logger] hha:end → flush now');
    flush(true);
  });

  window.addEventListener('beforeunload', () => flush(true));
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => flush(false), CFG.flushDelayMs);
}

async function flush(force) {
  if (!CFG.endpoint) return;

  clearTimeout(flushTimer);
  flushTimer = null;

  if (!queueSessions.length && !queueEvents.length) {
    if (CFG.debug) console.log('[HHA-Logger] nothing to flush');
    return;
  }

  const payload = {
    project: CFG.projectTag,
    sentAt:  new Date().toISOString(),
    sessions: queueSessions,
    events:   queueEvents
  };

  // เคลียร์คิวก่อน (กันส่งซ้ำถ้ารีเฟรช)
  queueSessions = [];
  queueEvents   = [];

  if (CFG.debug) {
    console.log('[HHA-Logger] FLUSH →', payload);
  }

  try {
    const res = await fetch(CFG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (CFG.debug) {
      console.log('[HHA-Logger] status', res.status);
    }
  } catch (err) {
    console.error('[HHA-Logger] flush error', err);
  }
}

export default { initCloudLogger };
