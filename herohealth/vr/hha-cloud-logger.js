// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (lightweight)
// ✅ Captures: hha:start, hha:time, hha:score, hha:judge, quest:update, hha:end
// ✅ Buffer + flush-hardened
// ✅ Endpoint via ?log= (Apps Script URL) OR store local
// Public: window.HHACloudLogger = { setContext, flush, flushNow }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(WIN.HHACloudLogger) return;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  const S = {
    ctx: {},
    buf: [],
    maxBuf: 120,
    endpoint: qs('log', null),
    lastScore: null,
    lastTime: null,
  };

  function nowISO(){
    try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); }
  }

  function push(type, detail){
    const rec = {
      ts: nowISO(),
      type,
      detail: detail || null,
      ctx: S.ctx || {}
    };
    S.buf.push(rec);
    if(S.buf.length > S.maxBuf) S.buf.shift();
  }

  async function postJSON(payload){
    if(!S.endpoint) return false;
    try{
      await fetch(S.endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
      return true;
    }catch(_){
      return false;
    }
  }

  function saveLocal(payload){
    try{
      const key = 'HHA_LOG_BUFFER';
      const old = JSON.parse(localStorage.getItem(key) || '[]');
      old.push(payload);
      while(old.length > 50) old.shift();
      localStorage.setItem(key, JSON.stringify(old));
    }catch(_){}
  }

  async function flushNow(meta){
    const payload = {
      ts: nowISO(),
      meta: meta || {},
      ctx: S.ctx || {},
      events: S.buf.splice(0, S.buf.length)
    };
    if(!payload.events.length) return;

    const ok = await postJSON(payload);
    if(!ok) saveLocal(payload);
  }

  function flush(meta){
    // fire-and-forget safe
    flushNow(meta);
  }

  function setContext(ctx){
    S.ctx = Object.assign({}, S.ctx || {}, ctx || {});
  }

  // listeners
  WIN.addEventListener('hha:start', (e)=>push('hha:start', e.detail), {passive:true});
  WIN.addEventListener('hha:time',  (e)=>{ S.lastTime = e.detail;  push('hha:time',  e.detail); }, {passive:true});
  WIN.addEventListener('hha:score', (e)=>{ S.lastScore= e.detail; push('hha:score', e.detail); }, {passive:true});
  WIN.addEventListener('hha:judge', (e)=>push('hha:judge', e.detail), {passive:true});
  WIN.addEventListener('quest:update', (e)=>push('quest:update', e.detail), {passive:true});
  WIN.addEventListener('hha:end',   (e)=>{ push('hha:end', e.detail); flush({reason:'hha:end'}); }, {passive:true});

  WIN.addEventListener('pagehide', ()=>flush({reason:'pagehide'}), {passive:true});
  WIN.addEventListener('beforeunload', ()=>flush({reason:'beforeunload'}), {passive:true});
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush({reason:'hidden'});
  }, {passive:true});

  WIN.HHACloudLogger = { setContext, flush, flushNow };
})();