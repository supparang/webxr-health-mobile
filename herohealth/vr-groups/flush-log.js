/* === /herohealth/vr-groups/flush-log.js ===
Flush Logger — HHA Standard
✅ bindFlushOnLeave(getPayloadFn)
- If ?log= is present: POST JSON via sendBeacon or fetch(keepalive)
- safe: does nothing when log is missing
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function getLogUrl(){
    const u = String(qs('log','')||'').trim();
    return u || '';
  }

  async function postJson(url, obj){
    const body = JSON.stringify(obj||{});
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], {type:'application/json'}));
        if (ok) return true;
      }
    }catch(_){}
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body,
        keepalive:true,
        mode:'no-cors'
      });
      return true;
    }catch(_){}
    return false;
  }

  NS.bindFlushOnLeave = function(getPayloadFn){
    const url = getLogUrl();
    if (!url) return;

    const handler = ()=>{
      try{
        const payload = (typeof getPayloadFn === 'function') ? getPayloadFn() : null;
        if (!payload) return;
        postJson(url, payload);
      }catch(_){}
    };

    try{ root.addEventListener('pagehide', handler, { passive:true }); }catch(_){}
    try{ root.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') handler();
    }, { passive:true }); }catch(_){}
    try{ root.addEventListener('beforeunload', handler, { passive:true }); }catch(_){}
  };

})(typeof window!=='undefined' ? window : globalThis);