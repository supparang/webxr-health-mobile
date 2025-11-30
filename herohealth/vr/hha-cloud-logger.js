// === /herohealth/vr/hha-cloud-logger.js ===
// ฟังก์ชันกลางสำหรับส่ง Log ขึ้น Google Apps Script
// รองรับ 3 ระดับ: session, event, summary

export function initCloudLogger(opts = {}) {
  const endpoint = opts.endpoint || '';
  const project  = opts.projectTag || 'HeroHealth';
  const debug    = !!opts.debug;

  if (!endpoint) {
    console.warn('[CloudLogger] endpoint ว่าง – ยังไม่ส่ง Google Sheet');
    return;
  }

  let sessionId = null;
  let seq       = 0;

  function send(kind, payload) {
    const body = {
      kind,              // 'session' | 'event' | 'summary'
      project,
      sessionId,
      ts: Date.now(),
      ...payload
    };

    if (debug) console.log('[CloudLogger] send', body);

    // ใช้ no-cors เพื่อลดปัญหา CORS (จะมองไม่เห็น response แต่ส่งได้)
    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(err => console.error('[CloudLogger] fetch error', err));
  }

  // ---- Session level (ชีต SESSIONS) ----
  window.addEventListener('hha:session', (e) => {
    const d = (e && e.detail) || {};
    // ถ้ายังไม่มี sessionId ให้ผูกจาก event แรก
    sessionId = d.sessionId || sessionId || ('HHA-' + Date.now());

    send('session', {
      ...d,
      sessionId
    });
  });

  // ---- Event level (ชีต EVENTS) ----
  window.addEventListener('hha:event', (e) => {
    const d = (e && e.detail) || {};
    if (!sessionId && d.sessionId) sessionId = d.sessionId;

    send('event', {
      ...d,
      sessionId,
      seq: ++seq
    });
  });

  // ---- Summary ตอนจบเกม (เก็บเพิ่มใน SUMMARY) ----
  window.addEventListener('hha:end', (e) => {
    const d = (e && e.detail) || {};
    send('summary', {
      ...d,
      sessionId
    });
  });
}

export default { initCloudLogger };
