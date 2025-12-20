// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger (PROD) — sessions + events
// ✅ Fix: Works with GAS Web App under CORS restrictions
//    - use navigator.sendBeacon() (preferred) OR fetch({mode:'no-cors'}) with text/plain
//    - avoid application/json to prevent preflight
// ✅ Fix: auto-bind to game events: hha:end (session) + hha:event (event)
// ✅ Back-compat: also accepts hha:log_session / hha:log_event if you dispatch manually

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

function log(...a){ if (CONFIG.debug) console.log('[HHA-Logger]', ...a); }
function warn(...a){ if (CONFIG.debug) console.warn('[HHA-Logger]', ...a); }

export function initCloudLogger(opts = {}) {
  CONFIG.endpoint = String(opts.endpoint || CONFIG.endpoint || '');
  CONFIG.debug = !!opts.debug;

  if (!CONFIG.endpoint) {
    warn('No endpoint set. Logger will queue but never flush.');
  }

  // bind once
  if (!window.__HHA_LOGGER_BOUND__) {
    window.__HHA_LOGGER_BOUND__ = true;

    // ---- Back-compat manual events ----
    window.addEventListener('hha:log_session', (e) => enqueueSession(e.detail));
    window.addEventListener('hha:log_event',   (e) => enqueueEvent(e.detail));

    // ---- Auto capture from games ----
    // Session summary
    window.addEventListener('hha:end', (e) => {
      const row = safeObj(e.detail);
      // normalize
      row.type = row.type || 'session_end';
      row.timestampIso = row.timestampIso || new Date().toISOString();
      enqueueSession(row);
    });

    // Event stream
    window.addEventListener('hha:event', (e) => {
      const row = safeObj(e.detail);
      row.timestampIso = row.timestampIso || new Date().toISOString();
      enqueueEvent(row);
    });

    // Optional: if you also want to log misses/score changes uncomment:
    // window.addEventListener('hha:miss', (e)=>enqueueEvent({ type:'miss', ...safeObj(e.detail), timestampIso:new Date().toISOString() }));
    // window.addEventListener('hha:score',(e)=>enqueueEvent({ type:'score',...safeObj(e.detail), timestampIso:new Date().toISOString() }));
  }

  log('init', CONFIG.endpoint);
}

function enqueueSession(row){
  sessionsQueue.push(safeObj(row));
  scheduleFlush();
}

function enqueueEvent(row){
  eventsQueue.push(safeObj(row));
  scheduleFlush();
}

function scheduleFlush(){
  if (flushTimer) return;
  flushTimer = setTimeout(flushNow, FLUSH_DELAY);
}

// ✅ Send without CORS trouble:
// - sendBeacon() sends "simple" request; response is irrelevant for logging
// - fetch no-cors + text/plain avoids preflight and avoids CORS block
function sendPayload(endpoint, payload){
  const body = JSON.stringify(payload);

  // 1) sendBeacon (best for logs)
  try{
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain;charset=utf-8' }));
      return { ok, method: 'beacon' };
    }
  } catch(_) {}

  // 2) fetch no-cors (opaque response, but request is sent)
  try{
    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    return { ok: true, method: 'fetch-no-cors' };
  } catch (err){
    return { ok: false, method: 'fetch-no-cors', err };
  }
}

function flushNow(){
  flushTimer = null;
  if (!CONFIG.endpoint) return;
  if (!sessionsQueue.length && !eventsQueue.length) return;

  const payload = {
    projectTag: (sessionsQueue[0]?.projectTag) || (eventsQueue[0]?.projectTag) || '',
    timestampIso: new Date().toISOString(),
    sessions: sessionsQueue.splice(0),
    events: eventsQueue.splice(0)
  };

  const res = sendPayload(CONFIG.endpoint, payload);

  log('flush', res.method, 'sessions=', payload.sessions.length, 'events=', payload.events.length);

  // If sending failed synchronously (rare), re-queue
  if (!res.ok) {
    warn('flush failed; requeue', res.err || '');
    sessionsQueue = payload.sessions.concat(sessionsQueue);
    eventsQueue   = payload.events.concat(eventsQueue);
    scheduleFlush();
  }
}
