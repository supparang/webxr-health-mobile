// === /herohealth/vr/view-helper.js ===
// HeroHealth — View Helper (Fullscreen + Orientation + Safe HUD offsets)
// - requestFullscreenBestEffort()
// - lockLandscapeBestEffort()
// - applyFsClass()
// - computeHudSafeOffsets() => {top,right,bottom,left} (px)
// NOTE: must be called from user gesture for fullscreen/orientation

(function(root){
  'use strict';
  const DOC = root.document;

  async function requestFullscreenBestEffort(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' });
      }
    }catch(_){}
    applyFsClass();
  }

  async function lockLandscapeBestEffort(){
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  function applyFsClass(){
    try{
      DOC.body.classList.toggle('is-fs', !!DOC.fullscreenElement);
    }catch(_){}
  }

  function computeHudSafeOffsets(){
    // HUD should avoid: safe-area + crosshair center zone + optional VR UI buttons (#hudBtns etc.)
    const sat = pxVar('--sat');
    const sab = pxVar('--sab');
    const sal = pxVar('--sal');
    const sar = pxVar('--sar');

    // crosshair center keep-out (so HUD not overlap center)
    // (this is conservative; tweak if needed)
    const keepCenter = 56;

    return {
      top:  Math.max(0, sat),
      right:Math.max(0, sar),
      bottom:Math.max(0, sab),
      left: Math.max(0, sal),
      keepCenter
    };
  }

  function pxVar(name){
    try{
      const v = getComputedStyle(DOC.documentElement).getPropertyValue(name).trim();
      if (!v) return 0;
      if (v.endsWith('px')) return parseFloat(v)||0;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }

  root.HHA_ViewHelper = {
    requestFullscreenBestEffort,
    lockLandscapeBestEffort,
    applyFsClass,
    computeHudSafeOffsets
  };

  // keep class in sync
  DOC.addEventListener('fullscreenchange', applyFsClass);
})(typeof window !== 'undefined' ? window : globalThis);