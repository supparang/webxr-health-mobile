// === /fitness/jd/jd-logger.js ===
// Jump-Duck Cloud Logger — PRODUCTION (flush-hardened)
// ✅ Uses ?log= endpoint (Apps Script / API)
// ✅ sendBeacon fallback, retries w/ fetch keepalive
// ✅ Flush on end + visibilitychange/pagehide

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
  }

  const endpoint = qs('log','');
  const enabled = !!endpoint;

  const queue = [];
  let flushing = false;

  function push(payload){
    if (!enabled) return;
    queue.push(payload);
  }

  async function postJSON(payload){
    if (!enabled) return true;
    const body = JSON.stringify(payload);

    // Try sendBeacon first (best for unload)
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(endpoint, new Blob([body], {type:'application/json'}));
        if (ok) return true;
      }
    }catch{}

    // Fallback fetch keepalive
    try{
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body,
        keepalive:true,
        mode:'cors',
        credentials:'omit'
      });
      return !!res && (res.ok || res.status === 0);
    }catch{
      return false;
    }
  }

  async function flush(forceAll=false){
    if (!enabled) return true;
    if (flushing) return false;
    flushing = true;
    try{
      // Send in small batches
      while(queue.length){
        const batch = queue.splice(0, forceAll ? queue.length : Math.min(20, queue.length));
        const ok = await postJSON({ type:'jd_batch', ts: Date.now(), items: batch });
        if (!ok){
          // Put back to front and stop
          queue.unshift(...batch);
          return false;
        }
      }
      return true;
    }finally{
      flushing = false;
    }
  }

  // Auto-flush events periodically
  setInterval(()=>{ flush(false); }, 2500);

  // Flush on unload
  function hardFlush(){
    flush(true);
  }
  WIN.addEventListener('pagehide', hardFlush);
  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden') hardFlush();
  });

  WIN.JD_LOGGER = { enabled, endpoint, push, flush };
})();