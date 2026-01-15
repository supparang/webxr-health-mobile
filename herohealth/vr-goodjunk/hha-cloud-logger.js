// === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
// Safe stub: listen to hha:end and log to console (no network)

(function(root){
  'use strict';
  function onEnd(e){
    try{
      const summary = e?.detail;
      console.log('[HHA LOGGER] hha:end', summary);
    }catch(_){}
  }
  root.addEventListener('hha:end', onEnd);
})(window);