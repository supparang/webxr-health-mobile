// === /herohealth/vr/hha-cloud-logger.js ===
// PROD schema logger: sessions + events (keys exactly match sheet columns)

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
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if (CONFIG.debug) console.log('[HHA-Logger] flush', res.status, payload);
  }catch(err){
    // ถ้าส่งไม่สำเร็จ -> คืนกลับคิว
    sessionsQueue = payload.sessions.concat(sessionsQueue);
    eventsQueue = payload.events.concat(eventsQueue);
    if (CONFIG.debug) console.warn('[HHA-Logger] flush error', err);
  }
}
