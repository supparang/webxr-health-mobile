// === /herohealth/vr/hha-event-bridge.js ===
// HHA Event Bridge — PRODUCTION (SAFE)
// Listens: hha:event + hha:judge + hha:start + hha:end
// Forwards to: HHA_LOGGER.logEvent() or HHA_CloudLogger.logEvent() if present
// Always buffers to: window.HHA_EVENT_QUEUE (for later flush)

(function(){
  'use strict';
  const WIN = window;

  if(WIN.__HHA_EVENT_BRIDGE__) return;
  WIN.__HHA_EVENT_BRIDGE__ = true;

  const QUEUE = WIN.HHA_EVENT_QUEUE = WIN.HHA_EVENT_QUEUE || [];

  function nowISO(){
    try{ return new Date().toISOString(); }catch{ return ''; }
  }

  function safeCopy(obj){
    try{ return JSON.parse(JSON.stringify(obj||{})); }catch{ return Object.assign({}, obj||{}); }
  }

  function getLogger(){
    // support either naming
    const A = WIN.HHA_LOGGER;
    if(A && typeof A.logEvent === 'function') return A;

    const B = WIN.HHA_CloudLogger;
    if(B && typeof B.logEvent === 'function') return B;

    return null;
  }

  function forward(type, detail){
    const payload = safeCopy(detail);
    payload.type = payload.type || type;
    payload.ts = payload.ts || nowISO();

    // buffer always
    QUEUE.push(payload);

    // forward if logger exists
    const L = getLogger();
    if(L){
      try{
        // try common signatures
        // logEvent(name, detail) or logEvent(detail)
        if(L.logEvent.length >= 2) L.logEvent(payload.type, payload);
        else L.logEvent(payload);
      }catch(_){}
    }
  }

  function onEvt(name){
    return function(ev){
      try{
        forward(name, ev && ev.detail ? ev.detail : {});
      }catch(_){}
    };
  }

  WIN.addEventListener('hha:event', onEvt('hha:event'));
  WIN.addEventListener('hha:judge', onEvt('hha:judge'));
  WIN.addEventListener('hha:start', onEvt('hha:start'));
  WIN.addEventListener('hha:end',   onEvt('hha:end'));
})();