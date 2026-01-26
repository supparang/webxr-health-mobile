// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened)
// ✅ Batch queue + sendBeacon first + fetch keepalive fallback
// ✅ Flush guards: pagehide, visibilitychange(hidden), beforeunload
// ✅ Exposes: window.HHA_LOGGER = { init(cfg), log(type,payload), flush(reason), getCtx() }
// ✅ Auto logs: hha:start, hha:end (if present)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  };

  const nowISO = ()=> new Date().toISOString();
  const rand = ()=> Math.random().toString(16).slice(2);
  const genId = ()=> `${Date.now()}-${rand()}-${rand()}`;

  const STATE = {
    enabled:false,
    endpoint:'',
    ctx:{},
    sessionId: genId(),
    queue: [],
    flushTimer: null,
    lastFlushAt: 0,
    maxBatch: 25,
    flushEveryMs: 1800,
    maxPayloadBytes: 180 * 1024, // safety
    inited:false
  };

  function safeJson(obj){
    try{ return JSON.stringify(obj); }catch{ return '{"err":"json"}'; }
  }

  function approxBytes(str){
    try{ return new Blob([str]).size; }catch{ return (str||'').length; }
  }

  function getEndpoint(cfg){
    // priority: cfg.logEndpoint > ?log=...
    const fromCfg = cfg && (cfg.logEndpoint || cfg.log || '');
    const fromQs = qs('log','') || '';
    const ep = (fromCfg || fromQs || '').trim();
    return ep;
  }

  function init(cfg){
    if(STATE.inited) return;
    STATE.inited = true;

    STATE.endpoint = getEndpoint(cfg);
    STATE.enabled = !!STATE.endpoint;

    // base ctx
    STATE.ctx = Object.assign({
      app: 'HeroHealth',
      game: (cfg && (cfg.game || '')) || '',
      page: location.pathname,
      href: location.href,
      ua: navigator.userAgent || '',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      sessionId: STATE.sessionId,
      tsStart: nowISO()
    }, (cfg || {}));

    // install flush guards even if disabled (cheap)
    attachFlushGuards();

    // auto listeners
    WIN.addEventListener('hha:start', (e)=>{
      log('start', e.detail || {});
      // quick flush to ensure session opens
      flush('start');
    });

    WIN.addEventListener('hha:end', (e)=>{
      log('end', e.detail || {});
      flush('end');
    });
  }

  function getCtx(){ return Object.assign({}, STATE.ctx); }

  function log(type, payload){
    if(!STATE.inited) init({});
    const ev = {
      type: String(type || 'event'),
      ts: nowISO(),
      t: Date.now(),
      payload: payload || {}
    };
    STATE.queue.push(ev);

    // lazy scheduled flush
    scheduleFlush();
  }

  function scheduleFlush(){
    if(STATE.flushTimer) return;
    STATE.flushTimer = setTimeout(()=>{
      STATE.flushTimer = null;
      flush('timer');
    }, STATE.flushEveryMs);
  }

  function buildBatch(reason){
    const batch = [];
    while(batch.length < STATE.maxBatch && STATE.queue.length){
      batch.push(STATE.queue.shift());
    }
    const bodyObj = {
      reason: reason || 'flush',
      ts: nowISO(),
      ctx: STATE.ctx,
      events: batch
    };
    const body = safeJson(bodyObj);

    // if too big, split
    if(approxBytes(body) > STATE.maxPayloadBytes && batch.length > 1){
      // put back half, send half
      const half = Math.ceil(batch.length / 2);
      const keep = batch.splice(half);
      // put keep back front
      STATE.queue = keep.concat(STATE.queue);
      return buildBatch(reason);
    }

    return { body, count: batch.length };
  }

  function sendBeacon(endpoint, body){
    try{
      if(!navigator.sendBeacon) return false;
      const blob = new Blob([body], { type:'application/json' });
      return navigator.sendBeacon(endpoint, blob);
    }catch{
      return false;
    }
  }

  function sendFetch(endpoint, body){
    try{
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      }).then(()=>true).catch(()=>false);
    }catch{
      return Promise.resolve(false);
    }
  }

  function flush(reason){
    if(!STATE.inited) init({});
    if(!STATE.enabled) return Promise.resolve(false);
    if(!STATE.queue.length) return Promise.resolve(true);

    const { body, count } = buildBatch(reason);
    if(!count) return Promise.resolve(true);

    // try beacon first
    const okBeacon = sendBeacon(STATE.endpoint, body);
    if(okBeacon){
      STATE.lastFlushAt = Date.now();
      // continue flushing remaining quickly
      if(STATE.queue.length) setTimeout(()=>flush('drain'), 0);
      return Promise.resolve(true);
    }

    // fallback fetch keepalive
    return sendFetch(STATE.endpoint, body).then((ok)=>{
      STATE.lastFlushAt = Date.now();
      if(STATE.queue.length) setTimeout(()=>flush('drain'), 0);
      return ok;
    });
  }

  function attachFlushGuards(){
    // pagehide = best for mobile safari too
    WIN.addEventListener('pagehide', ()=>{ flush('pagehide'); }, { capture:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if(DOC.visibilityState === 'hidden') flush('hidden');
    }, { capture:true });

    WIN.addEventListener('beforeunload', ()=>{ flush('beforeunload'); }, { capture:true });

    // back/forward cache restoration
    WIN.addEventListener('pageshow', (e)=>{
      if(e && e.persisted){
        // bfcache restore: new session id (optional)
        log('pageshow', { persisted:true });
        flush('pageshow');
      }
    });
  }

  WIN.HHA_LOGGER = Object.freeze({
    init,
    log,
    flush,
    getCtx
  });

  // Auto init with query only (if plate.boot calls init(cfg) later, it's fine)
  init({ logEndpoint: qs('log','') || '' });
})();