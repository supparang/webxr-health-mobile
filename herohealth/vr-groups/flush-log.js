// === /herohealth/vr-groups/flush-log.js ===
// GroupsVR Flush-Harden — PRODUCTION (PATCH v20260208e)
// ✅ Hooks: pagehide, beforeunload, visibilitychange(hidden)
// ✅ Calls: GroupsVR.Telemetry.flush(lastSummary) if present
// ✅ Safe: never throws; throttled; does not block UI
// ✅ Also exposes: window.GroupsVR.flushNow(summary)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};

  const S = {
    inited: false,
    lastFlushAt: 0
  };

  function now(){
    try{ return performance.now(); }catch{ return Date.now(); }
  }

  function safeGetTelemetry(){
    try{
      return WIN.GroupsVR && WIN.GroupsVR.Telemetry ? WIN.GroupsVR.Telemetry : null;
    }catch(_){
      return null;
    }
  }

  function flushOnce(summary){
    const t = now();
    if (t - S.lastFlushAt < 350) return; // throttle
    S.lastFlushAt = t;

    try{
      const T = safeGetTelemetry();
      if (!T || typeof T.flush !== 'function') return;
      T.flush(summary || null);
    }catch(_){}
  }

  function init(opts){
    if (S.inited) return;
    S.inited = true;

    const getSummary =
      (opts && typeof opts.getSummary === 'function')
        ? opts.getSummary
        : null;

    function grab(){
      try{ return getSummary ? getSummary() : null; }catch(_){ return null; }
    }

    // pagehide: best for mobile safari + bfcache
    WIN.addEventListener('pagehide', ()=>{
      flushOnce(grab());
    }, { passive:true });

    // beforeunload: desktop browsers
    WIN.addEventListener('beforeunload', ()=>{
      flushOnce(grab());
    });

    // visibility hidden: tab switch / app background
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        flushOnce(grab());
      }
    }, { passive:true });

    // optional: freeze (Chrome)
    try{
      DOC.addEventListener('freeze', ()=>{
        flushOnce(grab());
      }, { passive:true });
    }catch(_){}
  }

  // Expose a manual flush
  WIN.GroupsVR.flushNow = function(summary){
    flushOnce(summary || null);
  };

  WIN.GroupsVR.FlushLog = { init };

})();