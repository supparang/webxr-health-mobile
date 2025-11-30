// === /herohealth/vr/hha-cloud-logger.js ===
// ส่ง Session + Events ไป Google Apps Script (2 ชีต: Sessions, Events)

export function initCloudLogger(opts = {}) {
  const endpoint   = opts.endpoint || '';
  const projectTag = opts.projectTag || 'HeroHealth';
  const debug      = !!opts.debug;

  if (!endpoint) {
    console.warn('[HHA-Logger] endpoint not set');
    return;
  }

  const queue = [];
  let flushTimer = null;

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 1500);
  }

  async function flush() {
    flushTimer = null;
    if (!queue.length) return;

    const payload = queue.splice(0, queue.length);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectTag,
          events:  payload
        })
      });

      if (!res.ok) {
        if (debug) console.warn('[HHA-Logger] HTTP error', res.status);
      } else if (debug) {
        console.log('[HHA-Logger] sent payload', payload);
      }
    } catch (err) {
      if (debug) console.warn('[HHA-Logger] network error', err);
    }
  }

  function push(kind, data) {
    const base = {
      kind,
      tsIso: new Date().toISOString()
    };
    queue.push(Object.assign(base, data || {}));
    scheduleFlush();
  }

  window.addEventListener('hha:session', ev => {
    push('session', ev.detail || {});
  });

  window.addEventListener('hha:event', ev => {
    push('event', ev.detail || {});
  });

  if (debug) {
    console.log('[HHA-Logger] init', { endpoint, projectTag });
  }
}

export default { initCloudLogger };
