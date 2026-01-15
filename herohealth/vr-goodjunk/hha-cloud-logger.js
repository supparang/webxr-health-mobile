// === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
// Minimal Cloud Logger — LOCAL COPY (flush-hardened-ish)
// ✅ if ?log=<endpoint> then POST events + summary
// ✅ listens: hha:start, hha:judge, quest:update, hha:end, hha:log (optional)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const endpoint = qs('log', null);
  if(!endpoint) return;

  const queue = [];
  let flushing = false;

  function push(type, detail){
    queue.push({
      type,
      timestampIso: new Date().toISOString(),
      detail: detail ?? null,
      page: location.pathname,
      href: location.href,
    });
    flushSoon();
  }

  async function flush(){
    if(flushing) return;
    if(queue.length===0) return;
    flushing = true;

    const batch = queue.splice(0, Math.min(50, queue.length));
    try{
      await fetch(endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ kind:'hha-events', batch })
      });
    }catch(_){
      // put back if failed (best-effort)
      queue.unshift(...batch);
    }finally{
      flushing = false;
    }
  }

  let tmr = null;
  function flushSoon(){
    if(tmr) return;
    tmr = setTimeout(async ()=>{
      tmr = null;
      await flush();
    }, 250);
  }

  // harden on unload
  function flushSync(){
    try{
      const batch = queue.splice(0, queue.length);
      if(batch.length===0) return;
      const blob = new Blob([JSON.stringify({ kind:'hha-events', batch })], { type:'application/json' });
      navigator.sendBeacon?.(endpoint, blob);
    }catch(_){}
  }
  WIN.addEventListener('pagehide', flushSync);
  WIN.addEventListener('beforeunload', flushSync);

  // hook events
  WIN.addEventListener('hha:start', (e)=> push('hha:start', e.detail), { passive:true });
  WIN.addEventListener('hha:judge', (e)=> push('hha:judge', e.detail), { passive:true });
  WIN.addEventListener('quest:update', (e)=> push('quest:update', e.detail), { passive:true });
  WIN.addEventListener('hha:log', (e)=> push('hha:log', e.detail), { passive:true });
  WIN.addEventListener('hha:end', (e)=> push('hha:end', e.detail), { passive:true });

  // initial ping
  push('logger:ready', { endpoint });
})();