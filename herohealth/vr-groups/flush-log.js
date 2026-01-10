/* === /herohealth/vr-groups/flush-log.js ===
Flush Log — PRODUCTION (simple)
✅ postSummary(summary) -> POST JSON to ?log=...
✅ offline queue localStorage
✅ flush on pagehide/visibilitychange/beforeunload
*/

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  const LS_QUEUE = 'HHA_LOG_QUEUE_V1';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function getEndpoint(){
    return String(qs('log','')||'').trim();
  }

  function loadQueue(){
    try{ return JSON.parse(localStorage.getItem(LS_QUEUE)||'[]'); }catch{ return []; }
  }
  function saveQueue(q){
    try{ localStorage.setItem(LS_QUEUE, JSON.stringify(q.slice(0,100))); }catch{}
  }

  function enqueue(payload){
    const q = loadQueue();
    q.push(payload);
    saveQueue(q);
  }

  function dequeueAll(){
    const q = loadQueue();
    saveQueue([]);
    return q;
  }

  async function sendOnce(url, payload){
    const body = JSON.stringify(payload);

    // 1) sendBeacon
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], { type:'application/json' }));
        if (ok) return true;
      }
    }catch(_){}

    // 2) fetch keepalive
    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive:true
      });
      return !!(res && res.ok);
    }catch(_){}
    return false;
  }

  async function flush(){
    const url = getEndpoint();
    if (!url) return false;

    const q = dequeueAll();
    if (!q.length) return true;

    let okAll = true;
    for (const item of q){
      const ok = await sendOnce(url, item);
      if (!ok){
        okAll = false;
        enqueue(item); // put back
      }
    }
    return okAll;
  }

  async function postSummary(summary){
    const url = getEndpoint();
    if (!url){
      // no endpoint -> just keep local history
      return false;
    }

    // push then flush best-effort
    enqueue(summary);
    await flush();
    return true;
  }

  function bindFlushOnLeave(getLastSummary){
    if (!DOC) return;
    const doFlush = ()=>{
      // ensure last summary is queued (if any)
      try{
        const s = getLastSummary && getLastSummary();
        if (s) enqueue(s);
      }catch(_){}
      flush();
    };

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') doFlush();
    }, { passive:true });

    root.addEventListener('pagehide', doFlush, { passive:true });
    root.addEventListener('beforeunload', doFlush, { passive:true });
  }

  NS.postSummary = postSummary;
  NS.flushQueue = flush;
  NS.bindFlushOnLeave = bindFlushOnLeave;

})(typeof window !== 'undefined' ? window : globalThis);