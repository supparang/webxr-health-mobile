// === /herohealth/vr-groups/flush-log.js ===
// GroupsVR FlushLog — PRODUCTION (PACK 13.95 companion)
// ✅ window.GroupsVR.FlushLog.send(payload, {endpoint})
// ✅ window.GroupsVR.bindFlushOnLeave(getterFn)  (flush-hardened final summary)
// ✅ Best-effort delivery order: sendBeacon -> fetch(no-cors, text/plain) -> GET ?payload=
// ✅ Safe: never throws
//
// Endpoint expectations (recommended Apps Script style):
// - POST text/plain body = JSON string (no preflight)
// - OR GET ?payload=... (urlencoded JSON)
// - (Optional) JSONP ?callback=fn&payload=...
//
// Notes:
// - This module does NOT require CORS to succeed (no-cors + beacon).
// - It won't block navigation (fire-and-forget).
// - Large payloads: beacon/fetch OK; GET fallback may be truncated by URL limits.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.FlushLog && WIN.GroupsVR.FlushLog.__loaded) return;

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function safeJson(obj){
    try{ return JSON.stringify(obj); }catch(_){ return ''; }
  }
  function enc(s){
    try{ return encodeURIComponent(String(s||'')); }catch(_){ return ''; }
  }

  // -------------------------
  // Internal state
  // -------------------------
  const S = {
    __loaded: true,
    inited: false,
    endpoint: '',
    lastSendAt: 0,
    minGapMs: 120,        // anti-spam
    finalGetter: null,    // function => summary object
    finalSent: false
  };

  function canSend(endpoint){
    return !!(endpoint && String(endpoint).trim());
  }

  function normEndpoint(ep){
    ep = String(ep||'').trim();
    return ep;
  }

  // -------------------------
  // Transport methods
  // -------------------------
  function tryBeacon(endpoint, bodyStr){
    try{
      if (!WIN.navigator || typeof WIN.navigator.sendBeacon !== 'function') return false;
      if (!canSend(endpoint)) return false;
      const blob = new Blob([bodyStr], { type:'text/plain;charset=utf-8' });
      return WIN.navigator.sendBeacon(endpoint, blob);
    }catch(_){
      return false;
    }
  }

  async function tryFetch(endpoint, bodyStr){
    try{
      if (!canSend(endpoint)) return false;
      // no-cors: cannot read response, but prevents CORS from blocking
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type':'text/plain;charset=utf-8' },
        body: bodyStr
      });
      return true;
    }catch(_){
      return false;
    }
  }

  function tryGetPixel(endpoint, bodyStr){
    // Fallback for environments where fetch/beacon is blocked.
    // WARNING: URL length limits apply.
    try{
      if (!canSend(endpoint)) return false;
      const url = endpoint + (endpoint.includes('?') ? '&' : '?') + 'payload=' + enc(bodyStr);
      const img = new Image();
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = url;
      return true;
    }catch(_){
      return false;
    }
  }

  // -------------------------
  // Public sender
  // -------------------------
  async function send(payload, opts = {}){
    try{
      const endpoint = normEndpoint(opts.endpoint || S.endpoint);
      if (!canSend(endpoint)) return true; // local-only OK

      // throttle
      const t = nowMs();
      if ((t - S.lastSendAt) < S.minGapMs){
        // still try, but do not spam: just allow once per gap
        // we silently drop extra calls
        return true;
      }
      S.lastSendAt = t;

      const bodyStr = safeJson(payload) || '{}';

      // 1) Beacon (best for unload)
      const b = tryBeacon(endpoint, bodyStr);
      if (b) return true;

      // 2) Fetch POST text/plain (no-cors)
      const f = await tryFetch(endpoint, bodyStr);
      if (f) return true;

      // 3) GET fallback
      return tryGetPixel(endpoint, bodyStr);
    }catch(_){
      return false;
    }
  }

  // -------------------------
  // Flush-hardened final summary
  // -------------------------
  function buildFinalEnvelope(summary){
    const ts = new Date().toISOString();
    return {
      v: 'final-v1',
      projectTag: 'HeroHealth',
      gameTag: 'GroupsVR',
      ts,
      kind: 'final',
      summary: summary || null
    };
  }

  function sendFinalOnce(reason){
    try{
      if (S.finalSent) return;
      S.finalSent = true;

      const getter = S.finalGetter;
      const summary = (typeof getter === 'function') ? getter() : null;

      // include reason
      const payload = buildFinalEnvelope(Object.assign({}, summary||{}, { flushReason: reason||'leave' }));

      // fire-and-forget; do not await
      send(payload, { endpoint: S.endpoint });

    }catch(_){}
  }

  function bindFlushOnLeave(getterFn){
    try{
      S.finalGetter = (typeof getterFn === 'function') ? getterFn : null;
      S.finalSent = false;

      const onPageHide = ()=> sendFinalOnce('pagehide');
      const onBeforeUnload = ()=> sendFinalOnce('beforeunload');
      const onVis = ()=>{
        if (DOC && DOC.visibilityState === 'hidden') sendFinalOnce('hidden');
      };

      WIN.addEventListener('pagehide', onPageHide, { passive:true });
      WIN.addEventListener('beforeunload', onBeforeUnload, { passive:true });
      DOC && DOC.addEventListener('visibilitychange', onVis, { passive:true });

      // expose unbinder if needed
      return ()=>{
        try{
          WIN.removeEventListener('pagehide', onPageHide);
          WIN.removeEventListener('beforeunload', onBeforeUnload);
          DOC && DOC.removeEventListener('visibilitychange', onVis);
        }catch(_){}
      };
    }catch(_){
      return ()=>{};
    }
  }

  // -------------------------
  // Init
  // -------------------------
  function init(cfg = {}){
    try{
      S.endpoint = normEndpoint(cfg.endpoint || S.endpoint);
      S.inited = true;
    }catch(_){}
  }

  // -------------------------
  // Export
  // -------------------------
  const API = {
    __loaded: true,
    init,
    send,
    bindFlushOnLeave
  };

  WIN.GroupsVR.FlushLog = API;

  // ✅ convenience alias used by your run file
  // window.GroupsVR.bindFlushOnLeave(()=>summary)
  WIN.GroupsVR.bindFlushOnLeave = function(getterFn){
    try{ return bindFlushOnLeave(getterFn); }
    catch(_){ return ()=>{}; }
  };

})();