// === /herohealth/vr/hha-flush.js ===
// HHA Flush-Hardened Pack — v1.0.0
// ✅ pagehide / beforeunload / visibilitychange(hidden)
// ✅ sendBeacon first, then fetch keepalive
// ✅ safe no-op when no endpoint
// ✅ small queue batching helper (optional)
// API:
//   HHA_Flush.install({ getPayload, endpoint, getSummary, onFlush })
//   HHA_Flush.send(endpoint, payload)
//   HHA_Flush.makeQueue({ maxBytes, maxItems })

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const now = ()=>Date.now();

  function safeJson(obj){
    try{ return JSON.stringify(obj); }catch(_){ return '{}'; }
  }

  async function send(endpoint, payload){
    try{
      if(!endpoint) return false;
      const url = String(endpoint);
      const body = safeJson(payload);
      const blob = new Blob([body], { type:'application/json' });

      // 1) best for unload
      if(navigator && typeof navigator.sendBeacon === 'function'){
        const ok = navigator.sendBeacon(url, blob);
        if(ok) return true;
      }

      // 2) fetch keepalive (best effort)
      if(typeof fetch === 'function'){
        await fetch(url, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body,
          keepalive:true,
          credentials:'omit'
        }).catch(()=>{});
        return true;
      }
    }catch(_){}
    return false;
  }

  // Optional: simple queue (for engines that want buffering)
  function makeQueue({ maxBytes=220000, maxItems=2000 } = {}){
    const Q = {
      items:[],
      bytes:0,
      push(ev){
        try{
          const s = safeJson(ev);
          const b = s.length;
          if(Q.items.length >= maxItems) return false;
          if(Q.bytes + b > maxBytes) return false;
          Q.items.push(ev);
          Q.bytes += b;
          return true;
        }catch(_){ return false; }
      },
      drain(){
        const out = Q.items.slice();
        Q.items.length = 0;
        Q.bytes = 0;
        return out;
      }
    };
    return Q;
  }

  function install(opts){
    const O = opts || {};
    const endpoint = String(O.endpoint || qs('log','') || '');
    const getPayload = (typeof O.getPayload === 'function')
      ? O.getPayload
      : ()=>({ ts:now(), kind:'flush', payload:null });

    const getSummary = (typeof O.getSummary === 'function') ? O.getSummary : ()=>null;
    const onFlush = (typeof O.onFlush === 'function') ? O.onFlush : ()=>{};

    let did = false;

    function flushOnce(reason){
      if(did) return;
      did = true;
      try{ onFlush(reason); }catch(_){}

      const summary = (function(){ try{ return getSummary(); }catch(_){ return null; } })();
      const payload = (function(){ try{ return getPayload(reason, summary); }catch(_){ return { ts:now(), reason, summary:null }; } })();

      // attach standard fields if missing
      if(payload && typeof payload === 'object'){
        if(payload.ts == null) payload.ts = now();
        if(!payload.reason) payload.reason = reason || 'leave';
        if(summary && payload.summary == null) payload.summary = summary;
        payload.href = payload.href || String(location.href);
        payload.ua = payload.ua || (navigator && navigator.userAgent ? navigator.userAgent : '');
      }

      // Best effort send (even if no endpoint, still okay)
      if(endpoint){
        send(endpoint, payload);
      }
    }

    // pagehide is the #1 reliable
    WIN.addEventListener('pagehide', ()=>flushOnce('pagehide'), { capture:true });
    // beforeunload fallback
    WIN.addEventListener('beforeunload', ()=>flushOnce('beforeunload'), { capture:true });
    // mobile app switch
    DOC.addEventListener('visibilitychange', ()=>{
      if(DOC.visibilityState === 'hidden') flushOnce('visibility:hidden');
    }, { capture:true });

    // manual trigger
    return { flush:(reason)=>flushOnce(reason||'manual'), endpoint };
  }

  WIN.HHA_Flush = { install, send, makeQueue };

})();