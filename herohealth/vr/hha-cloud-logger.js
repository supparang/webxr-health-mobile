// === /herohealth/vr/hha-cloud-logger.js ===
// PROD schema logger: sessions + events (keys exactly match sheet columns)
// ✅ CORS-safe: sendBeacon หรือ fetch(no-cors) + Content-Type: text/plain (เลี่ยง preflight)
// ✅ Fire-and-forget: ไม่ต้องอ่าน response

'use strict';

let CONFIG = {
  endpoint: '',
  debug: false
};

let sessionsQueue = [];
let eventsQueue   = [];
let flushTimer = null;
const FLUSH_DELAY = 1200;

function safeObj(x){ return (x && typeof x==='object') ? x : {}; }

export function initCloudLogger(opts={}){
  CONFIG.endpoint = String(opts.endpoint || CONFIG.endpoint || '');
  CONFIG.debug = !!opts.debug;

  // bind once
  if (!window.__HHA_LOGGER_BOUND__){
    window.__HHA_LOGGER_BOUND__ = true;

    window.addEventListener('hha:log_session', (e)=>{
      const row = safeObj(e.detail);
      sessionsQueue.push(row);
      scheduleFlush();
    });

    window.addEventListener('hha:log_event', (e)=>{
      const row = safeObj(e.detail);
      eventsQueue.push(row);
      scheduleFlush();
    });
  }

  if (CONFIG.debug) console.log('[HHA-Logger] init', CONFIG.endpoint);
}

function scheduleFlush(){
  if (flushTimer) return;
  flushTimer = setTimeout(flushNow, FLUSH_DELAY);
}

async function flushNow(){
  flushTimer = null;
  if (!CONFIG.endpoint) return;
  if (!sessionsQueue.length && !eventsQueue.length) return;

  const payload = {
    projectTag: (sessionsQueue[0]?.projectTag) || (eventsQueue[0]?.projectTag) || '',
    timestampIso: new Date().toISOString(),
    sessions: sessionsQueue.splice(0),
    events: eventsQueue.splice(0)
  };

  try{
    const bodyText = JSON.stringify(payload);

    // 1) sendBeacon (ดีที่สุดสำหรับ log: ไม่สน CORS และส่งตอนปิดแท็บได้)
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyText], { type: 'text/plain;charset=utf-8' });
      const ok = navigator.sendBeacon(CONFIG.endpoint, blob);
      if (CONFIG.debug) console.log('[HHA-Logger] beacon', ok, payload);
      if (ok) return;
      // ถ้า beacon ล้ม → ไป fetch fallback
    }

    // 2) fetch แบบ no-cors + text/plain เพื่อหลบ preflight และไม่ต้องอ่าน response
    await fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: bodyText,
      keepalive: true
    });

    if (CONFIG.debug) console.log('[HHA-Logger] flush(no-cors) sent', payload);

  } catch(err){
    // ถ้าส่งไม่สำเร็จ -> คืนกลับคิว
    sessionsQueue = payload.sessions.concat(sessionsQueue);
    eventsQueue = payload.events.concat(eventsQueue);
    if (CONFIG.debug) console.warn('[HHA-Logger] flush error', err);
  }
}
