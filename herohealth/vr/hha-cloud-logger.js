// === /herohealth/vr/hha-cloud-logger.js ===
// Logger กลาง: รับ hha:session / hha:event → ส่งขึ้น Google Apps Script
let cfg = {
  endpoint: '',
  projectTag: 'HeroHealth',
  debug: false
};

let queue = [];
let flushTimer = null;

export function initCloudLogger(options = {}) {
  cfg = { ...cfg, ...options };

  if (!cfg.endpoint) {
    console.warn('[HHA-Logger] endpoint is empty, no logging will be sent.');
    return;
  }

  window.addEventListener('hha:session', (e) => onEvent('session', e.detail));
  window.addEventListener('hha:event',   (e) => onEvent('event',   e.detail));

  if (cfg.debug) {
    console.log('[HHA-Logger] init', cfg);
  }
}

function onEvent(kind, detail = {}) {
  if (!cfg.endpoint) return;

  const nowIso = new Date().toISOString();
  const rec = {
    kind,                       // 'session' หรือ 'event'
    project: cfg.projectTag,    // ชื่อโปรเจ็กต์
    ts: nowIso,
    // sheet name สำหรับ GAS แยกชีต
    sheet: kind === 'session' ? 'Sessions' : 'Events',
    ...detail
  };

  queue.push(rec);
  if (cfg.debug) console.log('[HHA-Logger] queued', rec);

  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer || queue.length === 0) return;
  flushTimer = setTimeout(flush, 1000);
}

async function flush() {
  flushTimer = null;
  if (!queue.length || !cfg.endpoint) return;

  const batch = queue.splice(0, queue.length);

  try {
    if (cfg.debug) console.log('[HHA-Logger] sending', batch.length, 'records');

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch })
    });

    const text = await res.text();
    if (!res.ok) {
      console.warn('[HHA-Logger] server error', res.status, text);
    } else if (cfg.debug) {
      console.log('[HHA-Logger] OK', text);
    }
  } catch (err) {
    console.error('[HHA-Logger] fetch error', err);
  }
}

// ป้องกันหายถ้า user ปิดหน้าเร็ว
window.addEventListener('beforeunload', () => {
  if (!queue.length || !cfg.endpoint) return;
  navigator.sendBeacon?.(
    cfg.endpoint,
    JSON.stringify({ records: queue.splice(0, queue.length) })
  );
});
