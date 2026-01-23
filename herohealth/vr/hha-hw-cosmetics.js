// === /herohealth/vr/hha-hw-cosmetics.js ===
// Apply small cosmetic flair based on XP Level (Local)
// API: HHA_HW_COS.apply()

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function apply(){
    try{
      const st = WIN.HHA_HW_XP?.get?.();
      const lvl = Number(st?.level||1);

      // set CSS vars on :root (safe)
      const root = DOC.documentElement;
      if(!root) return;

      // mild progression visuals (not intrusive)
      if(lvl >= 6) root.style.setProperty('--hw-glow', '1');
      else root.style.setProperty('--hw-glow', '0');

      if(lvl >= 10) root.style.setProperty('--hw-elite', '1');
      else root.style.setProperty('--hw-elite', '0');

    }catch{}
  }

  WIN.HHA_HW_COS = { apply };
})();