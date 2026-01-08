// === /herohealth/vr/view-auto.js ===
// HHA View Auto-Detect — PRODUCTION (NO OVERRIDE)
// ✅ Decide view: pc | mobile | cardboard | cvr
// ✅ Ignores ?view=... entirely (hard rule)
// ✅ Applies body classes: view-pc, view-mobile, cardboard, view-cvr
// ✅ Sets window.HHA_VIEW = { view, layers? } (optional layers set by your loader too)
// ✅ Best-effort: if WebXR immersive-vr supported => allow cVR by default (strict crosshair shooting)
// ✅ Cardboard split only if we detect "cardboard intent" (fullscreen + landscape OR stereo hints)
//
// How to use:
// <script src="../vr/view-auto.js" defer></script>
// (then your normal loader/boot)

// NOTE: This file intentionally does NOT ask user to choose mode.
//       If you still keep an overlay, it should only show "Tap to start" (no mode buttons).

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_VIEW_AUTO__) return;
  WIN.__HHA_VIEW_AUTO__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // --------- HARD RULE: ignore view override ----------
  // We do NOT read qs('view') at all.

  // --------- heuristics ----------
  const UA = (navigator.userAgent || '').toLowerCase();
  const isMobileUA =
    /\b(android|iphone|ipad|ipod|mobile)\b/.test(UA) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints >= 2);

  function inFullscreen(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }

  function landscape(){
    try{
      if (screen.orientation && typeof screen.orientation.type === 'string'){
        return screen.orientation.type.includes('landscape');
      }
    }catch(_){}
    try{
      return WIN.innerWidth > WIN.innerHeight;
    }catch(_){}
    return false;
  }

  function hasWebXR(){
    return !!(navigator.xr && typeof navigator.xr.isSessionSupported === 'function');
  }

  async function supportsImmersiveVR(){
    if (!hasWebXR()) return false;
    try{
      return await navigator.xr.isSessionSupported('immersive-vr');
    }catch(_){
      return false;
    }
  }

  // Cardboard intent signals:
  // - fullscreen + landscape (common when user tries cardboard)
  // - URL has "cardboard=1" OR "stereo=1" (optional, NOT "view=")  <-- allow non-view hint
  // - UA includes "oculusbrowser" / "pico" etc: treat as cVR (not split)
  function wantCardboardSplit(){
    const stereoHint = String(qs('stereo','') || qs('cardboard','') || '').trim();
    if (stereoHint === '1' || stereoHint === 'true') return true;
    // if user already entered fullscreen and landscape on mobile: strong cardboard intent
    if (isMobileUA && inFullscreen() && landscape()) return true;
    return false;
  }

  function isHeadsetBrowser(){
    // Headset browsers usually should be view-cvr (crosshair strict), not split cardboard
    return /\b(oculusbrowser|pico|viveport|quest)\b/.test(UA);
  }

  function chooseInitial(){
    // Headset: prefer cVR
    if (isHeadsetBrowser()) return 'cvr';

    // Mobile: prefer mobile or cardboard split if intent
    if (isMobileUA){
      if (wantCardboardSplit()) return 'cardboard';
      return 'mobile';
    }

    // Desktop: prefer pc, but if WebXR available, cvr gives crosshair/tap-to-shoot fallback too
    return 'pc';
  }

  function applyBody(view){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','cardboard','view-cvr');

    if (view === 'cardboard') b.classList.add('cardboard');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');

    // expose
    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
    cfg.view = view;
  }

  function maybeHideOverlay(){
    // If your page has startOverlay, hide it automatically (but keep "tap to start" if you want)
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;

    // If overlay has mode buttons, hide them (optional)
    try{
      ov.classList.add('hide'); // your CSS already supports #startOverlay.hide {display:none;}
    }catch(_){}
  }

  // Re-evaluate when fullscreen/orientation changes (cardboard intent can appear after user gesture)
  function reEvaluate(){
    const cur = (WIN.HHA_VIEW && WIN.HHA_VIEW.view) ? String(WIN.HHA_VIEW.view) : '';
    let next = cur || chooseInitial();

    // Upgrade logic (never downgrade aggressively):
    // - if mobile and now fullscreen+landscape => switch to cardboard split
    if (isMobileUA && wantCardboardSplit()) next = 'cardboard';

    // - if headset browser => cvr
    if (isHeadsetBrowser()) next = 'cvr';

    if (next && next !== cur){
      applyBody(next);
      // If your loader depends on layers mapping, you may also set it here:
      // (but your hydration loader already does this; this is a safe default)
      try{
        const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
        if (next === 'cardboard'){
          if (!cfg.layers) cfg.layers = ['hydration-layerL','hydration-layerR']; // generic default; per-game loader can override
        } else {
          if (!cfg.layers) cfg.layers = ['hydration-layer'];
        }
      }catch(_){}
    }
  }

  async function boot(){
    // choose initial fast
    const initial = chooseInitial();
    applyBody(initial);

    // Hide overlay immediately (no mode selection)
    maybeHideOverlay();

    // If WebXR immersive-vr supported on desktop, we can prefer cVR when user enters VR later,
    // but we won't force it at load.
    // (We still listen to changes)
    WIN.addEventListener('resize', ()=>reEvaluate(), { passive:true });
    DOC.addEventListener('fullscreenchange', ()=>reEvaluate(), { passive:true });
    try{
      screen.orientation && screen.orientation.addEventListener('change', ()=>reEvaluate());
    }catch(_){}

    // optional: after we confirm immersive-vr support on desktop, we can set a hint flag
    try{
      const ok = await supportsImmersiveVR();
      const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
      cfg.webxrVR = !!ok;
      // If on mobile and webxr vr supported and user already in fullscreen: still cardboard split is fine.
      // If on headset: reEvaluate will switch to cvr.
    }catch(_){}

    // final evaluate once
    reEvaluate();

    // Start event if you want auto-start after overlay removed
    // (leave it to your existing logic; uncomment if you want immediate start)
    // WIN.dispatchEvent(new CustomEvent('hha:start'));
  }

  // defer-safe: wait for body
  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();