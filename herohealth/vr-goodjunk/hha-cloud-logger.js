// === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
// Cloud Logger — PRODUCTION (flush-hardened)
// ✅ listens: hha:start, hha:end (and optional hha:log)
// ✅ posts JSON to ?log=SCRIPT_URL  (POST)
// ✅ tries sendBeacon on pagehide
// Notes: คุณสามารถต่อให้รับ schema sessions/events ได้ใน Apps Script

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const ENDPOINT = qs('log', null);

  const Q = [];
  let flushing = false;

  function enqueue(type, payload){
    Q.push({ type, payload, ts: new Date().toISOString() });
    flushSoon();
  }

  function flushSoon(){
    if(flushing) return;
    flushing = true;
    setTimeout(()=>flush().finally(()=>{ flushing=false; }), 80);
  }

  async function flush(){
    if(!ENDPOINT) return;
    if(!Q.length) return;

    const batch = Q.splice(0, Q.length);
    const body = JSON.stringify({ project:'HeroHealth', game:'GoodJunkVR', batch });

    // try fetch keepalive first
    try{
      await fetch(ENDPOINT, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive:true,
        mode:'cors',
      });
      return;
    }catch(_){}

    // fallback beacon
    try{
      const ok = navigator.sendBeacon?.(ENDPOINT, new Blob([body], {type:'application/json'}));
      if(ok) return;
    }catch(_){}
  }

  // listeners
  WIN.addEventListener('hha:start', (e)=> enqueue('start', e.detail || {}));
  WIN.addEventListener('hha:end',   (e)=> enqueue('end',   e.detail || {}));
  WIN.addEventListener('hha:log',   (e)=> enqueue('log',   e.detail || {}));
  WIN.addEventListener('pagehide',  ()=> { try{ flush(); }catch(_){ } });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden'){ try{ flush(); }catch(_){ } }
  });

  // expose manual flush
  WIN.HHA_LOGGER = { flush };
})();