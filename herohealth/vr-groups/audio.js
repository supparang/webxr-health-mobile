/* === /herohealth/vr-groups/audio.js ===
Audio helper — safe (no hard dependency)
✅ play(name) / stopAll()
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const A = NS.Audio = NS.Audio || {};
  const bank = Object.create(null);

  A.load = function(name, url){
    try{
      const au = new Audio(url);
      au.preload = 'auto';
      bank[name] = au;
      return true;
    }catch{ return false; }
  };

  A.play = function(name, vol){
    try{
      const au = bank[name];
      if(!au) return false;
      au.currentTime = 0;
      au.volume = (vol==null)? 0.9 : Math.max(0, Math.min(1, Number(vol)));
      au.play().catch(()=>{});
      return true;
    }catch{ return false; }
  };

  A.stopAll = function(){
    try{
      Object.values(bank).forEach(au=>{
        try{ au.pause(); au.currentTime=0; }catch(_){}
      });
    }catch(_){}
  };
})(typeof window!=='undefined' ? window : globalThis);