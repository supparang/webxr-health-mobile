// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR (DOM-safe)

import { boot as engineBoot } from './hygiene.safe.js';

(function(){
  'use strict';

  function start(){
    try{
      engineBoot();
    }catch(err){
      console.error('[Hygiene boot] failed', err);
      alert('HygieneVR boot error: ' + (err?.message || err));
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    start();
  }else{
    document.addEventListener('DOMContentLoaded', start, { once:true });
  }
})();