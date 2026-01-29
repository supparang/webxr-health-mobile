// === /herohealth/vr-groups/flush-log.js ===
// Flush-on-leave helper — PRODUCTION (SAFE)
// ✅ bindFlushOnLeave(getSummaryFn)
// ✅ tries: pagehide / visibilitychange / beforeunload
// ✅ best-effort: navigator.sendBeacon (if endpoint) or fetch keepalive
// ✅ never throws

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.bindFlushOnLeave) return;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function safeJson(obj){
    try{ return JSON.stringify(obj); }catch{ return ''; }
  }

  function nowIso(){
    try{ return new Date().toISOString(); }catch{ return ''; }
  }

  function getEndpoint(){
    // prefer query ?log=... (Apps Script, endpoint)
    const ep = String(qs('log','')||'').trim();
    return ep || '';
  }

  function postPayload(endpoint, payloadObj){
    // payloadObj should be small
    const endpointUrl = String(endpoint||'').trim();
    if (!endpointUrl) return false;

    const body = safeJson(payloadObj);
    if (!body) return false;

    // 1) sendBeacon (best on unload)
    try{
      if (navigator && navigator.sendBeacon){
        const blob = new Blob([body], { type:'text/plain;charset=utf-8' });
        const ok = navigator.sendBeacon(endpointUrl, blob);
        if (ok) return true;
      }
    }catch(_){}

    // 2) fetch keepalive (best-effort)
    try{
      if (WIN.fetch){
        WIN.fetch(endpointUrl, {
          method:'POST',
          headers:{ 'Content-Type':'text/plain;charset=utf-8' },
          body,
          keepalive:true,
          mode:'no-cors'
        }).catch(()=>{});
        return true;
      }
    }catch(_){}

    return false;
  }

  function bindFlushOnLeave(getSummaryFn){
    // getSummaryFn: ()=> summaryObj | null
    let fired = false;

    function fire(reason){
      if (fired) return;
      fired = true;

      let summary = null;
      try{ summary = getSummaryFn ? getSummaryFn() : null; }catch(_){ summary = null; }
      if (!summary || typeof summary !== 'object') return;

      // attach minimal meta
      try{
        summary.flushReason = String(reason||'leave');
        summary.flushAtIso = nowIso();
      }catch(_){}

      // if Telemetry module exists, let it flush first
      try{
        const T = WIN.GroupsVR && WIN.GroupsVR.Telemetry;
        if (T && typeof T.flushNow === 'function'){
          T.flushNow({ reason: String(reason||'leave') });
        }
      }catch(_){}

      // Optional endpoint push (summary only, lightweight)
      const ep = getEndpoint();
      if (!ep) return;

      // Wrap to align with Apps Script rows[] style if needed
      const payload = { kind:'summary', rows:[summary] };
      postPayload(ep, payload);
    }

    // pagehide is the most reliable on mobile safari / chrome
    WIN.addEventListener('pagehide', ()=>fire('pagehide'), { passive:true });

    // visibilitychange: when tab backgrounded
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') fire('hidden');
    }, { passive:true });

    // beforeunload: desktop fallback
    WIN.addEventListener('beforeunload', ()=>fire('beforeunload'), { passive:true });

    // expose manual flush too
    return { flush: fire };
  }

  WIN.GroupsVR.bindFlushOnLeave = bindFlushOnLeave;

})();