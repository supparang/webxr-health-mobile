// === /herohealth/vr/hha-logger-client.js ===
// HHA Logger Client — PRODUCTION (UNIVERSAL)
// ✅ Reads endpoint from: window.HHA_LOGGER_ENDPOINT or ?endpoint=
// ✅ Enables logging by: ?log=1 or ?log=true or ?log=on
// ✅ Buffers events from window.HHA_EVENT_QUEUE (filled by hha-event-bridge.js)
// ✅ Persists offline queue to localStorage
// ✅ Flush-hardened: visibilitychange/pagehide/beforeunload
// ✅ Sends: {batch:[events...]} and {type:'hha:end', session:{...}} to Google Apps Script

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_LOGGER_CLIENT__) return;
  WIN.__HHA_LOGGER_CLIENT__ = true;

  const LS_QUEUE = 'HHA_OFFLINE_EVENT_QUEUE_V1';
  const LS_LAST_SESSION = 'HHA_LAST_SESSION_V1';

  function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  function boolQ(k){
    const v = String(qs(k,'')||'').toLowerCase();
    return (v==='1'||v==='true'||v==='on'||v==='yes'||v==='y');
  }
  function nowISO(){ try{ return new Date().toISOString(); }catch{ return ''; } }

  function safeJsonParse(s, d){ try{ return JSON.parse(s); }catch{ return d; } }
  function safeJsonStr(o, d){ try{ return JSON.stringify(o); }catch{ return d; } }

  function getEndpoint(){
    // priority: query param > global
    const epQ = qs('endpoint', '');
    if(epQ) return epQ;

    const ep = WIN.HHA_LOGGER_ENDPOINT || '';
    return String(ep||'');
  }

  const CFG = {
    enabled: boolQ('log') || !!WIN.HHA_LOG_ENABLED,
    endpoint: getEndpoint(),
    batchMax: Number(WIN.HHA_LOG_BATCH_MAX || 30),
    flushMs: Number(WIN.HHA_LOG_FLUSH_MS || 1200),
    retryBaseMs: Number(WIN.HHA_LOG_RETRY_BASE_MS || 900),
    retryMaxMs: Number(WIN.HHA_LOG_RETRY_MAX_MS || 8000),
  };

  // shared queue
  const LIVE = WIN.HHA_EVENT_QUEUE = WIN.HHA_EVENT_QUEUE || [];
  let offline = safeJsonParse(localStorage.getItem(LS_QUEUE) || '[]', []);
  if(!Array.isArray(offline)) offline = [];

  let timer = 0;
  let inflight = false;
  let retryMs = CFG.retryBaseMs;

  function mergeCtx(ev){
    // ensure common fields exist (session_id/game may be injected by game)
    const out = Object.assign({}, ev || {});
    out.ts = out.ts || nowISO();
    out.type = out.type || 'hha:event';
    // pass-through query params that matter (optional)
    out.run = out.run || qs('run', '');
    out.view = out.view || qs('view', '');
    out.diff_label = out.diff_label || qs('diff', '');
    out.time_limit = out.time_limit || qs('time', '');
    out.seed = out.seed || qs('seed', '');
    return out;
  }

  function takeFromLive(maxN){
    const n = Math.max(0, Math.min(maxN, LIVE.length));
    if(n<=0) return [];
    const chunk = LIVE.splice(0, n);
    return chunk.map(mergeCtx);
  }

  function persistOffline(){
    try{ localStorage.setItem(LS_QUEUE, safeJsonStr(offline, '[]')); }catch(_){}
  }

  function pushOffline(list){
    if(!list || !list.length) return;
    for(const it of list){
      offline.push(mergeCtx(it));
    }
    // guard size (keep last 2000)
    if(offline.length > 2000) offline = offline.slice(offline.length - 2000);
    persistOffline();
  }

  function takeOffline(maxN){
    const n = Math.max(0, Math.min(maxN, offline.length));
    if(n<=0) return [];
    const chunk = offline.splice(0, n);
    persistOffline();
    return chunk;
  }

  async function postJSON(payload){
    const ep = CFG.endpoint;
    if(!ep) throw new Error('NO_ENDPOINT');
    const body = safeJsonStr(payload, '{}');

    // try sendBeacon for unload situations (best-effort)
    if(payload.__beacon){
      try{
        const ok = navigator.sendBeacon(ep, new Blob([body], {type:'application/json'}));
        if(ok) return {beacon:true};
      }catch(_){}
      // fallback to fetch
    }

    const res = await fetch(ep, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body
    });
    if(!res.ok) throw new Error('HTTP_'+res.status);
    return res.json().catch(()=>({ok:true}));
  }

  async function flushOnce(reason){
    if(!CFG.enabled) return {skipped:true};
    if(inflight) return {busy:true};
    if(!CFG.endpoint) return {noEndpoint:true};

    inflight = true;

    // move some live -> offline buffer first (so we never lose them)
    pushOffline(takeFromLive(CFG.batchMax));

    // take offline chunk to send
    const batch = takeOffline(CFG.batchMax);
    if(!batch.length){
      inflight = false;
      retryMs = CFG.retryBaseMs;
      return {empty:true};
    }

    try{
      const payload = { batch, reason, ts: nowISO() };
      await postJSON(payload);
      inflight = false;
      retryMs = CFG.retryBaseMs;
      return {sent: batch.length};
    }catch(err){
      // put back to front (preserve order)
      offline = batch.concat(offline);
      persistOffline();

      inflight = false;
      // exponential-ish backoff
      retryMs = Math.min(CFG.retryMaxMs, Math.round(retryMs * 1.6));
      return {error:String(err), retryMs};
    }
  }

  function scheduleFlush(){
    if(!CFG.enabled) return;
    if(timer) return;
    timer = WIN.setTimeout(async ()=>{
      timer = 0;
      const r = await flushOnce('timer');
      // if still has data, schedule again
      if(CFG.enabled && (LIVE.length>0 || offline.length>0) && !r.busy){
        scheduleFlush();
      }
    }, CFG.flushMs);
  }

  // expose API
  const API = WIN.HHA_LoggerClient = {
    cfg: CFG,
    enable(v){ CFG.enabled = !!v; },
    setEndpoint(ep){ CFG.endpoint = String(ep||''); },
    enqueue(ev){ pushOffline([ev]); scheduleFlush(); },
    flush(reason){ return flushOnce(reason || 'manual'); },
    flushBeacon(reason){
      // best-effort: pack a small batch and beacon it
      if(!CFG.enabled || !CFG.endpoint) return;
      pushOffline(takeFromLive(CFG.batchMax));
      const batch = takeOffline(Math.min(20, CFG.batchMax));
      if(!batch.length) return;
      // if beacon fails, we will already have removed; so re-buffer first:
      offline = batch.concat(offline);
      persistOffline();
      // try beacon (payload marked)
      postJSON({batch, reason:reason||'beacon', ts:nowISO(), __beacon:true}).catch(()=>{});
    },
    saveLastSession(summary){
      try{ localStorage.setItem(LS_LAST_SESSION, safeJsonStr(summary, '{}')); }catch(_){}
    },
    loadLastSession(){
      return safeJsonParse(localStorage.getItem(LS_LAST_SESSION)||'null', null);
    }
  };

  // auto schedule when new live events appear
  // (game can also call HHA_LoggerClient.flush('...'))
  const OBS_MS = 600;
  let lastLiveLen = LIVE.length;
  WIN.setInterval(()=>{
    if(!CFG.enabled) return;
    if(LIVE.length !== lastLiveLen){
      lastLiveLen = LIVE.length;
      // move to offline and schedule
      pushOffline(takeFromLive(CFG.batchMax));
      scheduleFlush();
    }
  }, OBS_MS);

  // hardened flush on lifecycle
  function flushHardened(tag){
    try{
      // move live to offline, then beacon flush
      pushOffline(takeFromLive(CFG.batchMax));
      API.flushBeacon(tag);
    }catch(_){}
  }

  WIN.addEventListener('pagehide', ()=>flushHardened('pagehide'));
  WIN.addEventListener('beforeunload', ()=>flushHardened('beforeunload'));
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flushHardened('visibilitychange');
  });

  // startup: schedule if offline exists
  if(CFG.enabled && (offline.length>0 || LIVE.length>0)) scheduleFlush();

})();