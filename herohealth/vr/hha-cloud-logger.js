// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — FAIR / PRODUCTION
// ✅ listens: hha:start, hha:end, hha:score, hha:time, hha:miss, hha:judge, hha:boss, hha:storm, quest:update
// ✅ send via navigator.sendBeacon if possible, else fetch keepalive
// ✅ enabled only when ?log=<endpoint> is provided
// ✅ flush-hardened on pagehide/visibilitychange/beforeunload

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  const ENDPOINT = qs('log', null);
  if(!ENDPOINT){
    WIN.__HHA_LOGGER_DISABLED__ = true;
    return;
  }

  const sessionId = (() => {
    const base = String(qs('studyId', qs('study','NA')) || 'NA');
    const t = Date.now();
    const r = Math.floor(Math.random()*1e9);
    return `hha_${base}_${t}_${r}`;
  })();

  const ctx = {
    sessionId,
    projectTag: qs('projectTag', null),
    view: qs('view', null),
    runMode: qs('run', null),
    diff: qs('diff', null),
    time: qs('time', null),
    seed: qs('seed', null) ?? qs('ts', null),

    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),

    href: location.href,
    ua: navigator.userAgent || '',
    tzOffsetMin: new Date().getTimezoneOffset(),
  };

  const queue = [];
  let flushing = false;

  function nowIso(){ return new Date().toISOString(); }

  function push(type, detail){
    queue.push({
      type,
      t: nowIso(),
      detail: detail || null,
      ctx
    });
    // keep queue sane
    if(queue.length > 2500) queue.splice(0, queue.length - 1800);
  }

  function sendPayload(payload){
    const body = JSON.stringify(payload);

    // Beacon first
    try{
      if(navigator.sendBeacon){
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type:'application/json' }));
        if(ok) return true;
      }
    }catch(_){}

    // Fetch keepalive fallback
    try{
      fetch(ENDPOINT, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body,
        keepalive:true,
        mode:'cors',
        credentials:'omit',
      }).catch(()=>{});
      return true;
    }catch(_){}
    return false;
  }

  function flush(reason='flush'){
    if(flushing) return;
    if(queue.length === 0) return;
    flushing = true;

    const batch = queue.splice(0, queue.length);
    const payload = {
      kind:'hha_log_batch',
      reason,
      sentAt: nowIso(),
      sessionId,
      ctx,
      items: batch
    };

    sendPayload(payload);
    flushing = false;
  }

  function onAny(evtName){
    return function(ev){
      // detail may be absent
      const detail = (ev && ev.detail) ? ev.detail : null;
      push(evtName, detail);

      // strategic flush: on end
      if(evtName === 'hha:end'){
        flush('end');
      }
    };
  }

  // ✅ listen events
  const EVENTS = [
    'hha:start',
    'hha:end',
    'hha:score',
    'hha:time',
    'hha:miss',
    'hha:judge',
    'hha:boss',
    'hha:storm',
    'quest:update',
    'hha:boot',
    'hha:coach',
    'hha:log',
  ];

  EVENTS.forEach((n)=>{
    WIN.addEventListener(n, onAny(n), { passive:true });
    DOC.addEventListener(n, onAny(n), { passive:true });
  });

  // periodic flush (light)
  setInterval(()=>flush('interval'), 4000);

  // flush-hardened
  WIN.addEventListener('pagehide', ()=>flush('pagehide'), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush('hidden');
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush('beforeunload'));

  // initial ping
  push('logger:init', { endpoint: ENDPOINT });
  flush('init');
})();