// === /herohealth/vr-groups/flush-log.js ===
// Flush-hardened logger (optional endpoint via ?log=...)
// API: window.GroupsVR.bindFlushOnLeave(getSummaryFn)

(function(){
  'use strict';
  const W = window;
  const NS = W.GroupsVR = W.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function safeJson(x){
    try { return JSON.stringify(x); } catch { return ''; }
  }

  function send(url, payload){
    if (!url) return false;
    const body = safeJson(payload);
    if (!body) return false;

    // try beacon first
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], {type:'application/json'}));
        if (ok) return true;
      }
    }catch(_){}

    // fallback fetch keepalive
    try{
      fetch(url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body,
        keepalive:true,
        mode:'no-cors'
      }).catch(()=>{});
      return true;
    }catch(_){}
    return false;
  }

  function bindFlushOnLeave(getSummaryFn){
    const url = String(qs('log','')||'').trim();
    if (!url) return;

    const flush = ()=>{
      try{
        const s = getSummaryFn && getSummaryFn();
        if (!s) return;
        send(url, s);
      }catch(_){}
    };

    // multiple hooks
    window.addEventListener('pagehide', flush, {passive:true});
    window.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') flush();
    }, {passive:true});
    window.addEventListener('beforeunload', flush);

    // expose manual
    NS.flushNow = flush;
  }

  NS.bindFlushOnLeave = bindFlushOnLeave;
})();