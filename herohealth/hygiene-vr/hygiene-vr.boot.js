// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR (DOM-ready safe)

import { boot as engineBoot } from './hygiene.safe.js';

(function(){
  'use strict';

  function start(){
    try{ engineBoot(); }catch(err){ console.error('[HygieneVR] boot error', err); }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }
})();