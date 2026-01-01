/* === /herohealth/vr-groups/flush-log.js ===
Flush-hardened logger for summary payload
- uses ?log= URL
- fetch keepalive + sendBeacon fallback
Expose: window.GroupsVR.postSummary(summary) -> Promise<boolean>
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const DOC = root.document;

  function qs(k, def=''){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  async function postJSON(url, payload){
    if (!url) return false;
    const body = JSON.stringify(payload||{});
    // 1) fetch keepalive
    try{
      const r = await fetch(url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body,
        keepalive:true,
        mode:'cors',
        credentials:'omit'
      });
      if (r && (r.ok || (r.status>=200 && r.status<300))) return true;
    }catch(_){}

    // 2) sendBeacon fallback
    try{
      if (navigator.sendBeacon){
        const blob = new Blob([body], {type:'application/json'});
        return navigator.sendBeacon(url, blob);
      }
    }catch(_){}

    return false;
  }

  async function postSummary(summary){
    const logUrl = String(qs('log','')||'').trim();
    if (!logUrl) return false;
    return postJSON(logUrl, summary);
  }

  // Flush helper: call when leaving
  function bindFlushOnLeave(getLastSummaryFn){
    function flush(){
      try{
        const s = getLastSummaryFn && getLastSummaryFn();
        if (s) postSummary(s);
      }catch(_){}
    }
    root.addEventListener('pagehide', flush, {passive:true});
    root.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') flush();
    }, {passive:true});
  }

  NS.postSummary = postSummary;
  NS.bindFlushOnLeave = bindFlushOnLeave;

})(typeof window !== 'undefined' ? window : globalThis);