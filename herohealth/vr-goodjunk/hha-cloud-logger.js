// === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
// Minimal Cloud Logger (HHA Standard)
// Usage: add ?log=https://script.google.com/macros/s/XXXX/exec
// It will POST JSON { type, payload, ts, ...meta } as events.

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  const endpoint = qs('log', null);
  if(!endpoint){
    // no endpoint => still keep buffer for debugging
    WIN.__HHA_LOGGER__ = { enabled:false, buffer:[] };
    return;
  }

  const meta = {
    project: 'HeroHealth',
    game: 'GoodJunkVR',
    href: location.href,
    ua: navigator.userAgent,
  };

  const buf = [];
  let flushBusy = false;

  function push(type, payload){
    buf.push({
      type,
      payload: payload || null,
      ts: new Date().toISOString(),
      ...meta
    });
    // keep cap
    if(buf.length > 800) buf.splice(0, buf.length - 800);
  }

  async function flush(reason='flush'){
    if(flushBusy) return;
    if(!buf.length) return;
    flushBusy = true;

    const batch = buf.splice(0, buf.length);
    try{
      await fetch(endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ reason, events: batch })
      });
    }catch(_){
      // put back if failed (best-effort)
      buf.unshift(...batch);
    }finally{
      flushBusy = false;
    }
  }

  // bind events
  WIN.addEventListener('hha:start', (e)=>{ push('start', e.detail); flush('start'); }, { passive:true });
  WIN.addEventListener('hha:judge', (e)=>{ push('judge', e.detail); }, { passive:true });
  WIN.addEventListener('quest:update', (e)=>{ push('quest', e.detail); }, { passive:true });
  WIN.addEventListener('hha:log', (e)=>{ push('log', e.detail); }, { passive:true });
  WIN.addEventListener('hha:end', (e)=>{ push('end', e.detail); flush('end'); }, { passive:true });

  // flush hardened
  WIN.addEventListener('pagehide', ()=>{ try{ flush('pagehide'); }catch(_){ } }, { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    try{
      if(DOC.visibilityState === 'hidden') flush('hidden');
    }catch(_){}
  }, { passive:true });

  // periodic flush
  setInterval(()=>{ flush('interval'); }, 2500);

  WIN.__HHA_LOGGER__ = { enabled:true, endpoint, buffer:buf, flush };
})();