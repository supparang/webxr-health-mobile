// === /herohealth/vr-groups/flush-log.js ===
// Flush-hardened logger — PRODUCTION
// ✅ If URL has ?log=https://... endpoint, send summary JSON on leave/end
// ✅ Uses navigator.sendBeacon when possible, fallback fetch keepalive
// ✅ Safe: never throws

(function(){
  'use strict';
  const WIN = window;
  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function safeJson(x){
    try{ return JSON.stringify(x); }catch{ return '{}'; }
  }

  async function post(endpoint, payload){
    const body = safeJson(payload);
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(endpoint, new Blob([body], {type:'application/json'}));
        if (ok) return true;
      }
    }catch(_){}

    try{
      const r = await fetch(endpoint, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body,
        keepalive:true,
        mode:'cors'
      });
      return !!r.ok;
    }catch(_){
      return false;
    }
  }

  // Public binder: pass a function that returns lastSummary object (or null)
  NS.bindFlushOnLeave = function(getSummary){
    const endpoint = String(qs('log','')||'').trim();
    if (!endpoint) return;

    let sent = false;

    async function flush(reason){
      if (sent) return;
      sent = true;

      let s = null;
      try{ s = (typeof getSummary === 'function') ? getSummary() : null; }catch(_){}
      if (!s) s = { reason: String(reason||'leave'), gameTag:'GroupsVR', timestampIso: new Date().toISOString() };

      const payload = Object.assign({
        gameTag:'GroupsVR',
        reason: String(reason||'leave'),
        url: location.href,
        ts: Date.now()
      }, s);

      try{ await post(endpoint, payload); }catch(_){}
    }

    // flush on end if possible
    WIN.addEventListener('hha:end', ()=>flush('end'), { once:true, passive:true });

    // flush on navigation
    WIN.addEventListener('pagehide', ()=>flush('pagehide'), { once:true, passive:true });
    WIN.addEventListener('beforeunload', ()=>flush('beforeunload'), { once:true, passive:true });
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') flush('hidden');
    }, { passive:true });
  };

})();