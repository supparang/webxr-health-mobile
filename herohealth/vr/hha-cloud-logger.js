// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION
// ✅ Listens: hha:start / hha:end / hha:score / hha:time / hha:adaptive / hha:ai (optional)
// ✅ Primary payload: hha:end SUMMARY DIRECT (single row object) — best for Google Sheet
// ✅ Queue in localStorage (crash-safe)
// ✅ Flush-hardened: sendBeacon first, then fetch keepalive
// ✅ Exposes: window.HHA_LOGGER.flush(reason)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const LS_Q = 'HHA_LOG_QUEUE_V1';
  const LS_LAST_ERR = 'HHA_LOG_LAST_ERR';

  // ✅ Put your Apps Script exec endpoint here (or set window.HHA_LOGGER_ENDPOINT)
  const DEFAULT_ENDPOINT = (WIN.HHA_LOGGER_ENDPOINT || '').trim();

  const CFG = {
    endpoint: DEFAULT_ENDPOINT,
    maxQueue: 80,
    flushTimeoutMs: 900,
    debug: false
  };

  function loadQ(){
    try{
      const s = localStorage.getItem(LS_Q);
      const a = s ? JSON.parse(s) : [];
      return Array.isArray(a) ? a : [];
    }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_Q, JSON.stringify(q)); }catch(_){}
  }
  function pushQ(item){
    const q = loadQ();
    q.unshift(item);
    while(q.length > CFG.maxQueue) q.pop();
    saveQ(q);
    return q.length;
  }
  function setLastErr(msg){
    try{ localStorage.setItem(LS_LAST_ERR, String(msg||'')); }catch(_){}
  }

  function hasEndpoint(){
    const ep = (CFG.endpoint || WIN.HHA_LOGGER_ENDPOINT || '').trim();
    CFG.endpoint = ep;
    return !!ep;
  }

  function postJSON(url, obj){
    const body = JSON.stringify(obj);
    // sendBeacon (best-effort)
    try{
      if(navigator && typeof navigator.sendBeacon === 'function'){
        const ok = navigator.sendBeacon(url, new Blob([body], { type:'application/json' }));
        if(ok) return Promise.resolve({ ok:true, via:'beacon' });
      }
    }catch(_){}

    // fetch keepalive
    return fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body,
      keepalive:true,
      cache:'no-store',
      credentials:'omit',
      mode:'cors'
    }).then(r=>({ ok: r.ok, status:r.status, via:'fetch' }))
      .catch(err=>({ ok:false, err:String(err||'fetch-failed'), via:'fetch' }));
  }

  async function flush(reason){
    try{
      if(!hasEndpoint()){
        // still keep queue (offline/config missing)
        return { ok:false, reason:'no-endpoint' };
      }

      let q = loadQ();
      if(!q.length) return { ok:true, reason:'empty' };

      // send oldest last => pop from end (preserve order)
      const batch = q.slice().reverse();
      const payload = {
        kind: 'hha-logger',
        reason: reason || 'flush',
        ts: new Date().toISOString(),
        items: batch
      };

      const res = await Promise.race([
        postJSON(CFG.endpoint, payload),
        new Promise(resolve=>setTimeout(()=>resolve({ ok:false, err:'timeout', via:'timeout' }), CFG.flushTimeoutMs))
      ]);

      if(res && res.ok){
        // clear queue only if success
        saveQ([]);
        return { ok:true, sent: batch.length, via: res.via || 'unknown' };
      }else{
        setLastErr(res && (res.err || res.status || 'send-failed'));
        return { ok:false, sent:0, err:(res && (res.err || res.status)) || 'send-failed', via:res && res.via };
      }
    }catch(e){
      setLastErr(String(e||'flush-exception'));
      return { ok:false, err:String(e||'flush-exception') };
    }
  }

  // ----------- Event handlers -----------
  function onEvt(name, fn){
    try{ WIN.addEventListener(name, fn, { passive:true }); }catch(_){}
  }

  // Keep lightweight state (optional)
  let lastStart = null;
  let lastScore = null;

  onEvt('hha:start', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    lastStart = d;

    pushQ({
      type:'start',
      ts: new Date().toISOString(),
      data: d
    });

    if(CFG.debug) console.log('[HHA_LOG] start', d);
  });

  onEvt('hha:score', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    lastScore = d;

    // Optional: do NOT spam queue; keep only in memory unless you want it.
    // If you want: uncomment to sample every N sec.
    // pushQ({ type:'score', ts:new Date().toISOString(), data:d });

    if(CFG.debug) console.log('[HHA_LOG] score', d);
  });

  onEvt('hha:time', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    // Optional: keep minimal
    if(CFG.debug) console.log('[HHA_LOG] time', d);
  });

  onEvt('hha:adaptive', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if(CFG.debug) console.log('[HHA_LOG] adaptive', d);
  });

  onEvt('hha:ai', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if(CFG.debug) console.log('[HHA_LOG] ai', d);
  });

  // ✅ Main: hha:end summary direct
  onEvt('hha:end', (ev)=>{
    const summary = ev && ev.detail ? ev.detail : null;
    if(!summary) return;

    // attach last known start/score snapshot if helpful (non-breaking)
    const enriched = Object.assign({}, summary, {
      _lastStart: lastStart || null,
      _lastScore: lastScore || null
    });

    pushQ({
      type:'end',
      ts: new Date().toISOString(),
      data: enriched
    });

    if(CFG.debug) console.log('[HHA_LOG] end', enriched);

    // best-effort immediate flush
    flush('end').catch(()=>{});
  });

  // crash-safe flush triggers
  try{
    WIN.addEventListener('beforeunload', ()=>{ flush('beforeunload'); });
    DOC.addEventListener('visibilitychange', ()=>{ if(DOC.hidden) flush('hidden'); });
  }catch(_){}

  // Expose
  WIN.HHA_LOGGER = {
    flush,
    config: CFG,
    loadQueue: loadQ,
    clearQueue: ()=>saveQ([]),
    getLastError: ()=>{ try{return localStorage.getItem(LS_LAST_ERR)||'';}catch(_){return '';} }
  };

})();