// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health VR Cloud Logger (CORS-safe)
// - sendBeacon first, fallback fetch(no-cors)
// - auto-capture: session + events
// - emits: hha:logger { ok:boolean, msg:string }

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  debug: false
};

let sessionId = null;
let sessionStart = 0;
let lastScoreLogAt = 0;

let sessionSummary = {};
let eventQueue = [];

function uuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}

function emitLogger(ok, msg){
  window.dispatchEvent(new CustomEvent('hha:logger', { detail:{ ok, msg } }));
  if (CONFIG.debug) console.log('[HHA Logger]', ok, msg);
}

function packPayload(final=false){
  return {
    projectTag: CONFIG.projectTag,
    sessionId,
    ts: Date.now(),
    final,
    session: sessionSummary,
    events: eventQueue.slice(0, 500) // กัน payload ใหญ่เกิน
  };
}

async function send(payload){
  if (!CONFIG.endpoint) throw new Error('No endpoint');

  const body = JSON.stringify(payload);

  // 1) sendBeacon (ดีที่สุดกับ Apps Script / cross-origin)
  if (navigator.sendBeacon){
    const ok = navigator.sendBeacon(CONFIG.endpoint, new Blob([body], { type:'application/json' }));
    if (ok){
      emitLogger(true, payload.final ? 'logger: sent(final)' : 'logger: sent');
      return true;
    }
  }

  // 2) fetch no-cors (ยิงได้ แต่ read response ไม่ได้)
  await fetch(CONFIG.endpoint, {
    method:'POST',
    mode:'no-cors',
    headers:{ 'Content-Type':'application/json' },
    body
  });

  emitLogger(true, payload.final ? 'logger: sent(final/no-cors)' : 'logger: sent(no-cors)');
  return true;
}

function flush(final=false){
  if (!sessionId) return;
  if (!eventQueue.length && !final) return;

  const payload = packPayload(final);
  // เคลียร์คิวก่อน (กันส่งซ้ำ)
  eventQueue = [];

  send(payload).catch(err=>{
    emitLogger(false, 'logger: send failed (check console)');
    console.warn('[HHA Logger] send failed', err);
  });
}

function pushEvent(type, data){
  eventQueue.push({
    type,
    ts: Date.now(),
    data: data || {}
  });
  // ส่งเป็นช่วง ๆ
  if (eventQueue.length >= 30) flush(false);
}

export function initCloudLogger(opts = {}){
  CONFIG = {
    endpoint: opts.endpoint || sessionStorage.getItem('HHA_LOG_ENDPOINT') || '',
    projectTag: opts.projectTag || 'HeroHealth',
    debug: !!opts.debug
  };

  sessionId = uuid();
  sessionStart = Date.now();

  sessionSummary = {
    mode: opts.mode || '',
    runMode: opts.runMode || '',
    diff: opts.diff || '',
    challenge: opts.challenge || '',
    durationSec: opts.durationSec || null,
    studentKey: opts.studentKey || null,
    profile: opts.profile || null,
    ua: navigator.userAgent || ''
  };

  emitLogger(true, 'logger: ready');

  // --- listeners ---
  window.addEventListener('hha:score', (e)=>{
    const t = Date.now();
    // throttle score event
    if (t - lastScoreLogAt < 450) return;
    lastScoreLogAt = t;
    pushEvent('score', e.detail || {});
  });

  window.addEventListener('hha:judge', (e)=> pushEvent('judge', e.detail||{}));
  window.addEventListener('hha:miss',  (e)=> pushEvent('miss',  e.detail||{}));
  window.addEventListener('quest:update', (e)=> pushEvent('quest', e.detail||{}));

  window.addEventListener('hha:end', (e)=>{
    sessionSummary.endTs = Date.now();
    sessionSummary.durationMs = sessionSummary.endTs - sessionStart;
    sessionSummary.result = e.detail || {};
    pushEvent('end', e.detail || {});
    flush(true);
  });

  // ping (optional)
  pushEvent('start', { startedAt: sessionStart });
  flush(false);
}

export function logEvent(type, data){
  pushEvent(type, data);
}
export function flushNow(){
  flush(false);
}
