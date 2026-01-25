// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION
// ✅ Wait DOM ready
// ✅ Start engine (hygiene.safe.js exports boot)

import { boot as engineBoot } from './hygiene.safe.js';

(function(){
  'use strict';

  function start(){
    try{ engineBoot(); }catch(err){ console.error('[HygieneVR] engineBoot failed', err); }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();