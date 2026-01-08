// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened, keepalive)
// ✅ Auto-capture summary from: hha:end, HHA_LAST_SUMMARY (localStorage)
// ✅ Send to endpoint from URL param: ?log=...  (POST JSON)
// ✅ Also supports legacy: ?logq=... (GET querystring) for simple GAS
// ✅ Queue + retry (light) + keepalive + sendBeacon fallback
// ✅ Flush on: pagehide / visibilitychange / beforeunload
// ✅ Safe: never throws; no dependency

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_CLOUD_LOGGER_LOADED__) return;
  WIN.__HHA_CLOUD_LOGGER_LOADED__ = true;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  };

  const ENDPOINT_JSON = String(qs('log','') || '').trim();   // POST JSON
  const ENDPOINT_QS   = String(qs('logq','') || '').trim();  // GET querystring (legacy)
  const MODE          = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const GAME          = String(qs('gameMode','') || '').toLowerCase();
  const SESSION_ID    = String(qs('sessionId', qs('studentKey','')) || '');

  // enable if endpoint exists
  const ENABLED = !!(ENDPOINT_JSON || ENDPOINT_QS);

  // Queue in memory + persisted (best-effort)
  const STORE_KEY = 'HHA_LOG_QUEUE_V1';
  const QUEUE = [];

  function safeJsonParse(s){
    try{ return JSON.parse(String(s||'')); }catch(_){ return null; }
  }

  function loadQueue(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      const arr = safeJsonParse(raw);
      if (Array.isArray(arr)){
        for (const it of arr){
          if (it && typeof it === 'object') QUEUE.push(it);
        }
      }
    }catch(_){}
  }
  function saveQueue(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify(QUEUE.slice(0, 50)));
    }catch(_){}
  }

  function compact(obj){
    // remove undefined / functions / huge strings
    const out = {};
    for (const k in obj){
      const v = obj[k];
      if (v === undefined) continue;
      if (typeof v === 'function') continue;
      if (typeof v === 'string' && v.length > 8000) out[k] = v.slice(0,8000);
      else out[k] = v;
    }
    return out;
  }

  function withMeta(payload){
    const base = {
      timestampClientIso: new Date().toISOString(),
      page: location.pathname + location.search,
      referrer: DOC.referrer || '',
      ua: navigator.userAgent || '',
      runMode: payload.runMode || MODE,
      gameMode: payload.gameMode || GAME || payload.game || '',
      sessionId: payload.sessionId || SESSION_ID || '',
      seed: payload.seed || String(qs('seed','') || ''),
      diff: payload.diff || String(qs('diff','') || ''),
      studyId: payload.studyId || String(qs('studyId','') || ''),
      phase: payload.phase || String(qs('phase','') || ''),
      conditionGroup: payload.conditionGroup || String(qs('conditionGroup','') || ''),
      sessionOrder: payload.sessionOrder || String(qs('sessionOrder','') || '')
    };
    return compact(Object.assign(base, payload));
  }

  function enqueue(payload){
    const item = withMeta(payload || {});
    // de-dupe: if same sessionId+gameMode+reason+scoreFinal close, keep last
    try{
      const key = `${item.sessionId}|${item.gameMode}|${item.reason||''}|${item.scoreFinal||''}`;
      item.__key = key;
      const idx = QUEUE.findIndex(x => x && x.__key === key);
      if (idx >= 0) QUEUE[idx] = item;
      else QUEUE.push(item);
      // cap
      while (QUEUE.length > 50) QUEUE.shift();
      saveQueue();
    }catch(_){}
  }

  function toQueryString(obj){
    const p = new URLSearchParams();
    for (const k in obj){
      const v = obj[k];
      if (v === undefined || v === null) continue;
      p.set(k, String(v));
    }
    return p.toString();
  }

  async function postJSON(url, payload){
    // prefer fetch keepalive
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
        keepalive:true,
        cache:'no-store',
        credentials:'omit'
      });
      return true;
    }catch(_){}

    // fallback sendBeacon (needs Blob)
    try{
      if (navigator.sendBeacon){
        const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return true;
      }
    }catch(_){}

    return false;
  }

  async function getQS(url, payload){
    try{
      const full = url + (url.includes('?') ? '&' : '?') + toQueryString(payload);
      // keepalive for GET is not standardized, but fetch still may work
      await fetch(full, { method:'GET', keepalive:true, cache:'no-store', credentials:'omit' });
      return true;
    }catch(_){}
    // sendBeacon fallback (GET not supported by sendBeacon) => return false
    return false;
  }

  async function sendOne(item){
    if (!item) return true;
    if (!ENABLED) return true;

    // choose endpoint priority: JSON first
    if (ENDPOINT_JSON){
      const ok = await postJSON(ENDPOINT_JSON, item);
      if (ok) return true;
    }
    if (ENDPOINT_QS){
      const ok2 = await getQS(ENDPOINT_QS, item);
      if (ok2) return true;
    }
    return false;
  }

  let flushing = false;
  let lastFlushAt = 0;

  async function flushQueue(reason='flush'){
    if (!ENABLED) return;
    const t = Date.now();
    if (flushing) return;
    if (t - lastFlushAt < 350) return; // throttle
    lastFlushAt = t;
    flushing = true;

    try{
      // send oldest first
      for (let i=0; i<QUEUE.length; ){
        const item = QUEUE[i];
        // stamp flush reason (non-destructive)
        if (item && !item.__flushReason) item.__flushReason = reason;

        const ok = await sendOne(item);
        if (ok){
          QUEUE.splice(i,1);
          saveQueue();
          continue;
        }
        // stop on first failure (avoid hammer)
        break;
      }
    }catch(_){}
    finally{
      flushing = false;
    }
  }

  // --- Hook events ---
  function onEnd(ev){
    const payload = (ev && ev.detail) ? ev.detail : null;
    if (!payload || typeof payload !== 'object') return;
    enqueue(payload);
    flushQueue('hha:end');
  }

  // if game stores HHA_LAST_SUMMARY, we can enqueue on boot
  function bootEnqueueLast(){
    try{
      const raw = localStorage.getItem('HHA_LAST_SUMMARY') || localStorage.getItem('hha_last_summary') || '';
      const obj = safeJsonParse(raw);
      if (obj && typeof obj === 'object'){
        // only enqueue if same session not already logged (basic)
        enqueue(obj);
      }
    }catch(_){}
  }

  // flush on lifecycle
  function bindLifecycleFlush(){
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') flushQueue('visibility:hidden');
    });
    WIN.addEventListener('pagehide', ()=> flushQueue('pagehide'));
    WIN.addEventListener('beforeunload', ()=> flushQueue('beforeunload'));
    // mobile safari sometimes uses freeze
    WIN.addEventListener('freeze', ()=> flushQueue('freeze'));
  }

  // public API (optional)
  WIN.HHA_LOGGER = {
    enqueue,
    flush: flushQueue,
    enabled: ENABLED,
    endpoint: ENDPOINT_JSON || ENDPOINT_QS || ''
  };

  // init
  loadQueue();
  if (ENABLED){
    bootEnqueueLast();
    bindLifecycleFlush();
    // listen summary end events
    WIN.addEventListener('hha:end', onEnd);
    // initial flush attempt
    flushQueue('boot');
  }
})();