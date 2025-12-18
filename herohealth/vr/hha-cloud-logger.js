// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health VR Cloud Logger (robust)
// - POST text/plain JSON (ลด preflight)
// - fallback no-cors
// - sendBeacon on end/pagehide
// - emits: window event "hha:logger" { ok, message, status }

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  mode: '',
  runMode: 'play',
  diff: 'normal',
  durationSec: 60,
  studentKey: null,
  profile: null,
  debug: false
};

let session = null;
let eventQueue = [];
let flushTimer = null;

let bound = false;
let t0 = 0;

function nowIso(){ return new Date().toISOString(); }
function ms(){ return Math.round(performance.now()); }
function rel(){ return Math.max(0, ms() - t0); }

function uid(){
  const a = Math.random().toString(16).slice(2);
  const b = Date.now().toString(16);
  return `${b}-${a}`;
}

function emit(ok, message, status=''){
  try{
    window.dispatchEvent(new CustomEvent('hha:logger', {
      detail: { ok: !!ok, message: String(message||''), status: String(status||'') }
    }));
  }catch(_){}
  if (CONFIG.debug){
    const tag = ok ? '[LOGGER OK]' : '[LOGGER ERR]';
    console.log(tag, status, message);
  }
}

function safe(obj){
  try{ return JSON.parse(JSON.stringify(obj)); }
  catch(_){ return {}; }
}

async function postJSON(endpoint, payload, preferNoCors=false){
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' }; // ✅ simple request

  // 1) try beacon (if pagehide/end)
  if (payload && payload._useBeacon && navigator.sendBeacon){
    try{
      const blob = new Blob([body], { type:'text/plain;charset=utf-8' });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (ok) return { ok:true, via:'beacon' };
    }catch(_){}
  }

  // 2) fetch cors (readable response)
  if (!preferNoCors){
    try{
      const r = await fetch(endpoint, {
        method:'POST',
        headers,
        body,
        mode:'cors',
        credentials:'omit',
        redirect:'follow',
        keepalive:true
      });
      const text = await r.text().catch(()=> '');
      return { ok: r.ok, via:'cors', status:r.status, text };
    }catch(err){
      // fallthrough -> try no-cors
    }
  }

  // 3) fallback no-cors (opaque แต่ request จะออก)
  try{
    await fetch(endpoint, {
      method:'POST',
      headers,
      body,
      mode:'no-cors',
      keepalive:true
    });
    return { ok:true, via:'no-cors', status:0, text:'' };
  }catch(err){
    return { ok:false, via:'fail', status:0, text:String(err||'fetch failed') };
  }
}

function pushEvent(type, data={}){
  if (!session) return;
  eventQueue.push({
    t: rel(),
    ts: nowIso(),
    type,
    data: safe(data)
  });
  scheduleFlush();
}

function scheduleFlush(){
  if (flushTimer) return;
  flushTimer = setTimeout(()=>{
    flushTimer = null;
    flush(false);
  }, 1200);
}

async function flush(force){
  if (!session || !CONFIG.endpoint) return;
  if (!eventQueue.length && !force) return;

  const batch = eventQueue.splice(0, eventQueue.length);

  const payload = {
    projectTag: CONFIG.projectTag,
    mode: CONFIG.mode,
    runMode: CONFIG.runMode,
    diff: CONFIG.diff,
    durationSec: CONFIG.durationSec,
    sentAt: nowIso(),
    session: safe(session),
    events: batch
  };

  const res = await postJSON(CONFIG.endpoint, payload, false);

  if (res.ok){
    emit(true, `logger: sent (${batch.length}) via ${res.via}`, 'sent');
    return true;
  }

  // fail -> requeue
  eventQueue = batch.concat(eventQueue);
  emit(false, `logger: send failed (${res.via})`, 'send-fail');
  if (CONFIG.debug) console.warn('[HHA LOGGER] send failed detail:', res);
  return false;
}

async function flushFinal(reason='final'){
  if (!session || !CONFIG.endpoint) return;

  // mark end
  session.endedAt = nowIso();
  session.endReason = reason;

  const payload = {
    projectTag: CONFIG.projectTag,
    mode: CONFIG.mode,
    runMode: CONFIG.runMode,
    diff: CONFIG.diff,
    durationSec: CONFIG.durationSec,
    sentAt: nowIso(),
    _useBeacon: true, // ✅ try beacon first
    session: safe(session),
    events: eventQueue.splice(0, eventQueue.length)
  };

  const res = await postJSON(CONFIG.endpoint, payload, false);
  if (res.ok){
    emit(true, `logger: final sent via ${res.via}`, 'final');
  }else{
    // fallback no-cors
    const res2 = await postJSON(CONFIG.endpoint, payload, true);
    emit(!!res2.ok, `logger: final ${res2.ok ? 'sent' : 'failed'} via ${res2.via}`, 'final');
  }
}

function bindOnce(){
  if (bound) return;
  bound = true;

  window.addEventListener('hha:score', (e)=>{
    pushEvent('score', e.detail || {});
  });

  window.addEventListener('hha:judge', (e)=>{
    pushEvent('judge', e.detail || {});
  });

  window.addEventListener('quest:update', (e)=>{
    // keep it light
    const d = e.detail || {};
    pushEvent('quest', {
      goal: d.goal ? { id:d.goal.id, label:d.goal.label, prog:d.goal.prog, target:d.goal.target, done:d.goal.done } : null,
      mini: d.mini ? { id:d.mini.id, label:d.mini.label, prog:d.mini.prog, target:d.mini.target, done:d.mini.done } : null
    });
  });

  window.addEventListener('hha:end', (e)=>{
    pushEvent('end', e.detail || {});
    flushFinal((e.detail && e.detail.reason) ? e.detail.reason : 'end');
  });

  window.addEventListener('pagehide', ()=>{
    flushFinal('pagehide');
  });

  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden) flushFinal('hidden');
  });
}

export function initCloudLogger(opts = {}){
  CONFIG = {
    ...CONFIG,
    ...opts
  };

  if (!CONFIG.endpoint){
    emit(false, 'logger: missing endpoint', 'init');
    throw new Error('HHA logger missing endpoint');
  }

  t0 = ms();

  session = {
    sessionId: uid(),
    projectTag: CONFIG.projectTag,
    mode: CONFIG.mode,
    runMode: CONFIG.runMode,
    diff: CONFIG.diff,
    durationSec: CONFIG.durationSec,
    studentKey: CONFIG.studentKey || null,
    startedAt: nowIso(),
    ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    profile: safe(CONFIG.profile || null)
  };

  eventQueue = [];
  if (flushTimer){ clearTimeout(flushTimer); flushTimer = null; }

  bindOnce();
  emit(true, 'logger: init ok', 'init');

  // ส่ง session-start ทันที 1 ครั้ง (ช่วยเช็คว่าชีตเขียนได้ไหม)
  pushEvent('session_start', { studentKey: CONFIG.studentKey || null });
  flush(true);
}
