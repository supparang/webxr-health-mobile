// === /herohealth/vr-goodjunk/goodjunk-gesture-unlock-safe-v849m.js ===
// PATCH v20260606-GOODJUNK-GESTURE-UNLOCK-SAFE-V849M
// แก้ warning: navigator.vibrate / audio ถูก block ก่อน user gesture
// ไม่ยุ่งกับ win gate / summary / score

(function(){
  'use strict';

  if(window.GJ_GESTURE_UNLOCK_SAFE_V849M_LOADED) return;
  window.GJ_GESTURE_UNLOCK_SAFE_V849M_LOADED = true;

  const PATCH = 'v20260606-GOODJUNK-GESTURE-UNLOCK-SAFE-V849M';

  function markUnlocked(reason){
    window.GJ_USER_GESTURE_UNLOCKED = true;
    window.GJ_AUDIO_UNLOCKED = true;

    try{
      document.body.dataset.gjUserGesture = '1';
      document.documentElement.dataset.gjUserGesture = '1';
      localStorage.setItem('GJ_USER_GESTURE_UNLOCKED', JSON.stringify({
        patch: PATCH,
        reason: reason || 'gesture',
        at: new Date().toISOString()
      }));
    }catch(_){}

    tryResumeAudio();
  }

  function tryResumeAudio(){
    try{
      const ctxs = [];

      if(window.GJ_AUDIO_CONTEXT) ctxs.push(window.GJ_AUDIO_CONTEXT);
      if(window.gjAudioContext) ctxs.push(window.gjAudioContext);
      if(window.audioCtx) ctxs.push(window.audioCtx);
      if(window.AudioContext && window.__gjAudioContext) ctxs.push(window.__gjAudioContext);

      ctxs.forEach(function(ctx){
        try{
          if(ctx && ctx.state === 'suspended' && ctx.resume){
            ctx.resume().catch(function(){});
          }
        }catch(_){}
      });
    }catch(_){}
  }

  function safeVibrate(pattern){
    try{
      if(!navigator.vibrate) return false;

      const unlocked =
        window.GJ_USER_GESTURE_UNLOCKED ||
        window.GJ_AUDIO_UNLOCKED ||
        document.body.dataset.gjUserGesture === '1' ||
        document.documentElement.dataset.gjUserGesture === '1';

      if(!unlocked) return false;

      navigator.vibrate(pattern);
      return true;
    }catch(_){
      return false;
    }
  }

  window.GJ_SAFE_VIBRATE = safeVibrate;
  window.gjSafeVibrate = safeVibrate;

  ['pointerdown','touchstart','mousedown','keydown','click'].forEach(function(type){
    window.addEventListener(type, function(){
      markUnlocked(type);
    }, {
      capture: true,
      passive: true,
      once: false
    });
  });

  document.addEventListener('click', function(ev){
    const btn = ev.target && ev.target.closest
      ? ev.target.closest('#gjmStartBtn,.gjm-start-btn,button,[role="button"]')
      : null;

    if(btn){
      markUnlocked('start-button');
    }
  }, true);

  console.log('[GoodJunk Gesture Unlock Safe V849M] installed');
})();
