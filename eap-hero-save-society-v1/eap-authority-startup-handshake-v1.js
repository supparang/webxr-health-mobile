/* =========================================================
   EAP Hero • Authority Startup Handshake v1
   VERSION: 20260812-EAP-AUTHORITY-STARTUP-HANDSHAKE-V1

   Purpose
   - Close the startup race between Authority Runtime v3 and Resume Transport v180.
   - Never create a retry storm.
   - If a verified authority snapshot already exists, do nothing.
   - If runtime/transport are not ready yet, retry locally for a short bounded window.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_AUTHORITY_STARTUP_HANDSHAKE_V1__) return;
  window.__EAP_AUTHORITY_STARTUP_HANDSHAKE_V1__=true;

  var VERSION='20260812-EAP-AUTHORITY-STARTUP-HANDSHAKE-V1';
  var MAX_ATTEMPTS=12;
  var DELAY_MS=400;
  var attempts=0;
  var timer=0;
  var requested=false;

  function verified(){
    try{
      return !!(window.EAPAuthorityRuntime &&
        typeof window.EAPAuthorityRuntime.isVerified==='function' &&
        window.EAPAuthorityRuntime.isVerified());
    }catch(_){return false;}
  }

  function transportReady(){
    return !!(window.EAPPlayerResumeStableJSONP &&
      typeof window.EAPPlayerResumeStableJSONP.request==='function');
  }

  function runtimeReady(){
    return !!(window.EAPAuthorityRuntime &&
      typeof window.EAPAuthorityRuntime.refresh==='function');
  }

  function stop(reason){
    clearTimeout(timer);
    timer=0;
    document.documentElement.dataset.eapAuthorityHandshake=reason||'stopped';
  }

  function tick(){
    clearTimeout(timer);
    if(verified()){
      stop('verified');
      return;
    }

    attempts+=1;
    document.documentElement.dataset.eapAuthorityHandshake='waiting-'+attempts;

    if(runtimeReady() && transportReady() && !requested){
      requested=true;
      var started=false;
      try{ started=window.EAPAuthorityRuntime.refresh()!==false; }catch(_){ started=false; }
      document.documentElement.dataset.eapAuthorityHandshake=started?'requested':'request-deferred';
      /* If transport rejected only because another single-flight request is already active,
         do not start another one. The existing request will deliver eap:resume-synced. */
    }

    if(attempts>=MAX_ATTEMPTS){
      stop(verified()?'verified':'bounded-timeout');
      return;
    }
    timer=setTimeout(tick,DELAY_MS);
  }

  window.addEventListener('eap:single-authority-applied',function(){stop('verified');},{once:true});
  window.addEventListener('eap:resume-synced',function(){
    setTimeout(function(){if(verified())stop('verified');},0);
  });
  window.addEventListener('eap:profile-changed',function(){
    attempts=0; requested=false; clearTimeout(timer); timer=setTimeout(tick,100);
  });

  document.documentElement.dataset.eapAuthorityHandshakeVersion=VERSION;
  timer=setTimeout(tick,100);
})();
