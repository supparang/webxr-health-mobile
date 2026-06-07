/* === /herohealth/vr-goodjunk/goodjunk-gesture-unlock-safe-v850a.js === */
/* PATCH v20260607-GOODJUNK-GESTURE-UNLOCK-SAFE-V850A
   Purpose:
   - ลดปัญหา AudioContext / vibrate warning
   - unlock เฉพาะหลัง user gesture
   - ไม่ยุ่งกับ gameplay / summary
*/

(function(){
  'use strict';

  if (window.GJ_GESTURE_UNLOCK_SAFE_V850A_LOADED) return;
  window.GJ_GESTURE_UNLOCK_SAFE_V850A_LOADED = true;

  var PATCH = 'v20260607-GOODJUNK-GESTURE-UNLOCK-SAFE-V850A';
  var unlocked = false;
  var audioCtx = null;

  function unlock(reason){
    if (unlocked) return;
    unlocked = true;

    try{
      var AC = window.AudioContext || window.webkitAudioContext;

      if (AC){
        audioCtx = audioCtx || new AC();

        if (audioCtx.state === 'suspended'){
          audioCtx.resume().catch(function(){});
        }
      }
    }catch(_){}

    try{
      if (navigator.vibrate){
        navigator.vibrate(1);
      }
    }catch(_){}

    try{
      window.dispatchEvent(new CustomEvent('gj:gesture-unlocked', {
        detail:{
          patch: PATCH,
          reason: reason || '',
          unlockedAt: Date.now()
        }
      }));
    }catch(_){}

    console.log('[GoodJunk gesture unlock v850a] unlocked:', reason || '');
  }

  ['pointerdown','touchstart','click','keydown'].forEach(function(type){
    window.addEventListener(type, function(){
      unlock(type);
    }, { once:true, capture:true, passive:true });
  });

  window.GJ_GESTURE_UNLOCK_SAFE_V850A = {
    patch: PATCH,
    unlock: unlock,
    state: function(){
      return {
        patch: PATCH,
        unlocked: unlocked,
        audioState: audioCtx ? audioCtx.state : 'none'
      };
    }
  };

  console.log('[GoodJunk gesture unlock v850a] installed');
})();