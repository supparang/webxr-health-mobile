'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: '',
  mode: '',
  runMode: 'play',
  diff: 'normal',
  challenge: 'rush',
  durationPlannedSec: 60,
  studentKey: null,
  profile: null,
  debug: false
};

let session = null;
let events = [];
let flushTimer = null;

function dispatch(name, detail){
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function postJSON(url, payload){
  const res = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  const txt = await res.text().catch(()=> '');
  return { ok: res.ok, status: res.status, text: txt };
}

function scheduleFlush(){
  if (flushTimer) return;
  flushTimer = setTimeout(()=>{ flushTimer=null; flush(); }, 1400);
}

function logEvent(type, detail){
  events.push({
    ts: Date.now(),
    type,
    detail: detail || {}
  });
  scheduleFlush();
}

export function initCloudLogger(opts = {}) {
  CONFIG = { ...CONFIG, ...opts };
  if (!CONFIG.endpoint){
    dispatch('hha:logger', { ok:false, msg:'logger: no endpoint' });
    return;
  }

  session = {
    tsStart: Date.now(),
    projectTag: CONFIG.projectTag || '',
    mode: CONFIG.mode || '',
    runMode: CONFIG.runMode || 'play',
    diff: CONFIG.diff || 'normal',
    challenge: CONFIG.challenge || 'rush',
    durationPlannedSec: CONFIG.durationPlannedSec|0,
    studentKey: CONFIG.studentKey || null,
    profile: CONFIG.profile || null,
    ua: navigator.userAgent
  };

  if (CONFIG.debug) console.log('[HHA-Logger] init', CONFIG.endpoint);

  dispatch('hha:logger', { ok:true, msg:'logger: init ✓' });

  // attach listeners (minimal)
  window.addEventListener('hha:score', (e)=> logEvent('score', e.detail || {}));
  window.addEventListener('hha:time',  (e)=> logEvent('time',  e.detail || {}));
  window.addEventListener('quest:update', (e)=> logEvent('quest', e.detail || {}));
  window.addEventListener('quest:cleared', (e)=> logEvent('questCleared', e.detail || {}));
  window.addEventListener('quest:goodHit', (e)=> logEvent('goodHit', e.detail || {}));
  window.addEventListener('quest:badHit', (e)=> logEvent('badHit', e.detail || {}));
  window.addEventListener('quest:block',  (e)=> logEvent('block', e.detail || {}));
  window.addEventListener('quest:power',  (e)=> logEvent('power', e.detail || {}));

  // flush at end
  document.addEventListener('hha:end', (e)=>{
    logEvent('end', e.detail || {});
    flush(true);
  }, { once:true });
}

export async function flush(force=false){
  if (!CONFIG.endpoint || !session) return;

  // ถ้าไม่ได้ force และ events น้อยมาก ก็รอ
  if (!force && events.length < 8) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    sessions: [ session ],
    events: events.splice(0, events.length)
  };

  try{
    const r = await postJSON(CONFIG.endpoint, payload);
    if (CONFIG.debug) console.log('[HHA-Logger] flush', r.status, r.ok, r.text?.slice(0,80));

    dispatch('hha:logger', { ok: r.ok, msg: r.ok ? 'logger: ok' : `logger: ${r.status}` });
  }catch(err){
    dispatch('hha:logger', { ok:false, msg:'logger: network error' });
    if (CONFIG.debug) console.warn('[HHA-Logger] error', err);
  }
}
