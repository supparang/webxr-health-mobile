// === /herohealth/vr/hha-flush.js ===
// HHA Flush-Hardened Leave Guard — v1.0.0
// ✅ Calls available flushers safely on leave:
//    - window.GroupsVR.Telemetry.flush(summary?)
//    - window.HydrationVR.Telemetry.flush(summary?)
//    - window.GoodJunkVR.Telemetry.flush(summary?)   (if exists)
//    - window.HHA_Log.flush(summary?)                (generic)
// ✅ Also tries: navigator.sendBeacon fallback if you provide window.HHA_BEACON_ENDPOINT
// ✅ Hooks: pagehide, beforeunload, visibilitychange(hidden), freeze (if supported)
// ✅ Provides: window.HHA_Flush.bind(getSummaryFn, extraFlushFns?)
// NOTE: Never throws.

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

  function safe(fn){
    try{ fn && fn(); }catch(_){}
  }

  function getMaybeSummary(getSummaryFn){
    let s = null;
    try{ s = getSummaryFn ? getSummaryFn() : null; }catch(_){ s = null; }
    if (s && typeof s === 'object'){
      if (!s.ts) s.ts = Date.now();
      if (!s._flushAt) s._flushAt = Date.now();
    }
    return s;
  }

  // ---------- flusher discovery ----------
  function flushTelemetry(summary){
    // Known modules (optional)
    safe(()=>{ WIN.GroupsVR?.Telemetry?.flush?.(summary); });
    safe(()=>{ WIN.HydrationVR?.Telemetry?.flush?.(summary); });
    safe(()=>{ WIN.GoodJunkVR?.Telemetry?.flush?.(summary); });
    safe(()=>{ WIN.PlateVR?.Telemetry?.flush?.(summary); });

    // Generic
    safe(()=>{ WIN.HHA_Log?.flush?.(summary); });
    safe(()=>{ WIN.HHA_Telemetry?.flush?.(summary); });
  }

  function beaconFallback(summary){
    // Optional: if you want last-resort beacon send
    // Set: window.HHA_BEACON_ENDPOINT = 'https://.../collect'
    // And summary will be POSTed as JSON blob.
    const ep = String(WIN.HHA_BEACON_ENDPOINT || '');
    if (!ep) return;

    safe(()=>{
      const payload = JSON.stringify(summary || { ts:Date.now(), note:'no-summary' });
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(ep, new Blob([payload], {type:'application/json'}));
        if (ok) return;
      }
      // If no sendBeacon, do nothing (don't block unload)
    });
  }

  // ---------- bind ----------
  let bound = false;
  let lastFlushAt = 0;

  function bind(getSummaryFn, extraFlushFns){
    if (bound) return;
    bound = true;

    function doFlush(tag){
      const t = nowMs();
      if ((t - lastFlushAt) < 350) return; // rate-limit double events
      lastFlushAt = t;

      const summary = getMaybeSummary(getSummaryFn);
      if (summary && typeof summary === 'object'){
        summary._leaveTag = tag || '';
      }

      flushTelemetry(summary);

      if (Array.isArray(extraFlushFns)){
        for(const fn of extraFlushFns){
          safe(()=>fn && fn(summary));
        }
      }

      // last resort beacon (optional)
      beaconFallback(summary);
    }

    // pagehide: best for mobile (iOS/Android)
    WIN.addEventListener('pagehide', ()=>doFlush('pagehide'));

    // beforeunload: desktop fallback
    WIN.addEventListener('beforeunload', ()=>doFlush('beforeunload'));

    // visibility hidden: backgrounding
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') doFlush('hidden');
    });

    // freeze: Chrome can fire when page is being frozen
    WIN.addEventListener('freeze', ()=>doFlush('freeze'));

    // expose manual flush
    WIN.HHA_Flush = WIN.HHA_Flush || {};
    WIN.HHA_Flush.flushNow = ()=>doFlush('manual');
  }

  WIN.HHA_Flush = WIN.HHA_Flush || {};
  WIN.HHA_Flush.bind = bind;
})();