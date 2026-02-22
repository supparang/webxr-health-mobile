// === /fitness/js/logger-remote-guard.js ===
// Remote disable latch (401/403-safe) for Rhythm Boxer
'use strict';

(function(){
  const WIN = window;
  const KEY = 'RB_REMOTE_DISABLED';
  const TTL_MS = 15 * 60 * 1000; // 15 นาที

  function safeNow(){ return Date.now(); }

  function disableRemote(code, reason){
    try{
      const payload = {
        code: Number(code) || 403,
        reason: String(reason || ''),
        ts: safeNow()
      };
      sessionStorage.setItem(KEY, JSON.stringify(payload));
    }catch(_){}
  }

  function clearDisable(){
    try{ sessionStorage.removeItem(KEY); }catch(_){}
  }

  function disabledInfo(){
    try{
      const raw = sessionStorage.getItem(KEY);
      if(!raw) return { disabled:false };
      const d = JSON.parse(raw);
      if(!d || !d.ts) return { disabled:false };

      const age = safeNow() - Number(d.ts || 0);
      if(age > TTL_MS){
        try{ sessionStorage.removeItem(KEY); }catch(_){}
        return { disabled:false };
      }

      return {
        disabled:true,
        code: Number(d.code || 403),
        reason: String(d.reason || ''),
        ts: Number(d.ts || 0)
      };
    }catch(_){
      return { disabled:false };
    }
  }

  function isRemoteDisabled(){
    return !!disabledInfo().disabled;
  }

  WIN.RB_REMOTE_GUARD = {
    disableRemote,
    clearDisable,
    disabledInfo,
    isRemoteDisabled
  };
})();