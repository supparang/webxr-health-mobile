// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR (robust DOM-ready)
// ✅ Imports engine boot() from hygiene.safe.js
// ✅ Waits for #stage exists before starting

import { boot as engineBoot } from './hygiene.safe.js';

(function(){
  'use strict';

  function ready(fn){
    if (document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once:true });
    }
  }

  function waitForStage(timeoutMs=2500){
    const t0 = performance.now();
    return new Promise((resolve)=>{
      (function poll(){
        const st = document.getElementById('stage');
        if (st) return resolve(true);
        if ((performance.now() - t0) > timeoutMs) return resolve(false);
        setTimeout(poll, 30);
      })();
    });
  }

  ready(async ()=>{
    const ok = await waitForStage();
    if(!ok){
      console.warn('[HygieneVR] stage missing. Check HTML id="stage".');
      return;
    }
    try{
      engineBoot();
    }catch(err){
      console.error('[HygieneVR] boot failed', err);
    }
  });
})();