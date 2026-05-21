/* =========================================================
   HeroHealth Groups Solo Patch Loader
   PATCH SET: v20260520
   Use this only if the six patch files are uploaded to:
   /herohealth/patches/groups/
========================================================= */
(function(){
  'use strict';

  if (window.__HHA_GROUPS_SOLO_PATCH_LOADER_V20260520__) return;
  window.__HHA_GROUPS_SOLO_PATCH_LOADER_V20260520__ = true;

  const BASE = '/herohealth/patches/groups/';
  const VERSION = '20260520-final';

  const files = [
    '01-groups-solo-3view-stabilizer.js',
    '02-groups-solo-summary-mobile-final.js',
    '03-groups-solo-gameplay-mobile-cvr-final.js',
    '04-groups-solo-cooldown-flow-final.js',
    '05-groups-solo-save-log-final.js',
    '06-groups-solo-final-qa-gate.js'
  ];

  function load(src){
    return new Promise(function(resolve){
      const s = document.createElement('script');
      s.src = src + '?v=' + VERSION;
      s.async = false;
      s.onload = function(){ resolve(true); };
      s.onerror = function(){
        console.warn('[Groups Patch Loader] Failed:', src);
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  async function boot(){
    for (const f of files) {
      await load(BASE + f);
    }

    console.info('[Groups Patch Loader] loaded', files);
  }

  boot();
})();
