// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — S / FAIR
// ✅ thin boot (no logic duplication)
// ✅ pass params -> safe.js
// ✅ compatible with launcher + run html

import { boot } from './goodjunk.safe.js';

(function(){
  'use strict';

  const qs = (k, d=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  };

  const opts = {
    view:  String(qs('view','auto')).toLowerCase(),
    run:   String(qs('run','play')).toLowerCase(),   // play | research | practice
    diff:  String(qs('diff','normal')).toLowerCase(),// easy | normal | hard
    time:  Number(qs('time','80')) || 80,
    seed:  qs('seed', Date.now()),
    hub:   qs('hub', null),
    log:   qs('log', null),
  };

  // wait DOM ready (safe for mobile / webview)
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>boot(opts), { once:true });
  }else{
    boot(opts);
  }
})();