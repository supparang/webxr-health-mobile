// === /herohealth/vr-groups/flush-log.js ===
// Flush-hardened logger — PRODUCTION
// ✅ postSummary(summary): send to ?log=... (GAS/endpoint) with keepalive/beacon
// ✅ bindFlushOnLeave(getLastSummaryFn): flush on pagehide/visibilitychange/beforeunload
(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  const LOG_URL = String(qs('log','')||'');
  const QKEY = 'HHA_PENDING_LOGS_GROUPS';

  function loadQueue(){
    try{ return JSON.parse(localStorage.getItem(QKEY)||'[]') || []; }
    catch{ return []; }
  }
  function saveQueue(q){
    try{ localStorage.setItem(QKEY, JSON.stringify((q||[]).slice(0, 80))); }catch{}
  }
  function enqueue(summary){
    const q = loadQueue();
    q.unshift(summary);
    saveQueue(q);
  }

  async function sendOnce(summary){
    if (!LOG_URL) return false;
    const payload = JSON.stringify(summary||{});
    // Try beacon first
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(LOG_URL, new Blob([payload], {type:'application/json'}));
        if (ok) return true;
      }
    }catch(_){}
    // Fallback fetch keepalive
    try{
      const res = await fetch(LOG_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: payload,
        keepalive:true,
        mode:'cors'
      });
      return !!res && res.ok;
    }catch(_){
      return false;
    }
  }

  async function flushQueue(){
    if (!LOG_URL) return;
    const q = loadQueue();
    if (!q.length) return;

    const remain = [];
    for (let i=0;i<q.length;i++){
      const ok = await sendOnce(q[i]);
      if (!ok) remain.push(q[i]);
    }
    saveQueue(remain);
  }

  function postSummary(summary){
    try{
      if (!summary) return;
      enqueue(summary);
      // attempt immediate send, but keep queue if fail
      flushQueue();
    }catch(_){}
  }

  function bindFlushOnLeave(getLastSummaryFn){
    async function doFlush(){
      try{
        const s = getLastSummaryFn && getLastSummaryFn();
        if (s) enqueue(s);
      }catch(_){}
      try{ await flushQueue(); }catch(_){}
    }

    root.addEventListener('pagehide', doFlush, { passive:true });
    root.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') doFlush();
    }, { passive:true });
    root.addEventListener('beforeunload', doFlush, { passive:true });

    // also flush when page becomes visible again (helps after offline)
    root.addEventListener('focus', ()=>{ flushQueue(); }, { passive:true });

    // kick once
    flushQueue();
  }

  NS.postSummary = postSummary;
  NS.bindFlushOnLeave = bindFlushOnLeave;

})(typeof window !== 'undefined' ? window : globalThis);