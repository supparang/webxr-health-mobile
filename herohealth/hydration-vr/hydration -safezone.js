// === /herohealth/hydration-vr/hydration.safezone.js ===
// Hydration HUD-SAFE Auto — PRODUCTION (C)
// ✅ Measure HUD occupied zones (top/left/right/bottom) in px
// ✅ Expose: window.HHA_SAFE = { top, right, bottom, left } (px)
// ✅ Auto-updates on resize/orientation/fullscreen
// ✅ Works with PC/Mobile/cVR/Cardboard (cardboard uses #cbPlayfield rect)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_SAFEZONE__) return;
  WIN.__HHA_HYDRATION_SAFEZONE__ = true;

  const clamp = (v,min,max)=> v<min?min:(v>max?max:v);

  function getPlayfieldEl(){
    try{
      const b = DOC.body;
      if (b && b.classList.contains('cardboard')) return DOC.getElementById('cbPlayfield');
      return DOC.getElementById('playfield');
    }catch(_){ return DOC.getElementById('playfield'); }
  }

  function safeNum(n){ n=Number(n)||0; return isFinite(n)?n:0; }

  function rectOf(el){
    try{
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r || !isFinite(r.width) || !isFinite(r.height)) return null;
      return r;
    }catch(_){ return null; }
  }

  // union rects helper
  function expandBox(box, r){
    if (!box) return { l:r.left, t:r.top, r:r.right, b:r.bottom };
    return {
      l: Math.min(box.l, r.left),
      t: Math.min(box.t, r.top),
      r: Math.max(box.r, r.right),
      b: Math.max(box.b, r.bottom),
    };
  }

  function computeSafe(){
    const pf = getPlayfieldEl();
    const pfr = rectOf(pf) || { left:0, top:0, right:WIN.innerWidth, bottom:WIN.innerHeight, width:WIN.innerWidth, height:WIN.innerHeight };

    // default paddings (never 0) for comfort
    const basePad = 14;

    // collect HUD blocks
    const hud = DOC.querySelector('.hud');
    const startOverlay = DOC.getElementById('startOverlay');
    const resultBackdrop = DOC.getElementById('resultBackdrop');

    // If overlay is visible, we don't need to reserve HUD safe area (game not running)
    const overlayVisible = (startOverlay && !startOverlay.classList.contains('hide') && getComputedStyle(startOverlay).display !== 'none')
                        || (resultBackdrop && !resultBackdrop.hidden);

    // baseline safe insets from env(safe-area-inset-*) are already in CSS,
    // but we add a small extra basePad.
    let safe = { top: basePad, right: basePad, bottom: basePad, left: basePad };

    if (!overlayVisible && hud){
      // We measure panels that may cover playfield:
      // Strategy: find all ".panel" inside HUD and union their rects by edge zones.
      // Then compute occupied thickness from each edge.
      const panels = Array.from(hud.querySelectorAll('.panel'));
      let topBox=null, leftBox=null, rightBox=null, bottomBox=null;

      for (const el of panels){
        const r = rectOf(el);
        if (!r) continue;

        // classify panel by proximity to edges inside playfield
        const nearTop = (r.top - pfr.top) < (pfr.height * 0.35);
        const nearBottom = (pfr.bottom - r.bottom) < (pfr.height * 0.35);
        const nearLeft = (r.left - pfr.left) < (pfr.width * 0.35);
        const nearRight = (pfr.right - r.right) < (pfr.width * 0.35);

        if (nearTop) topBox = expandBox(topBox, r);
        if (nearBottom) bottomBox = expandBox(bottomBox, r);
        if (nearLeft) leftBox = expandBox(leftBox, r);
        if (nearRight) rightBox = expandBox(rightBox, r);
      }

      // thickness = occupied distance from edge
      if (topBox) safe.top = Math.max(safe.top, safeNum(topBox.b - pfr.top) + 10);
      if (bottomBox) safe.bottom = Math.max(safe.bottom, safeNum(pfr.bottom - bottomBox.t) + 10);
      if (leftBox) safe.left = Math.max(safe.left, safeNum(leftBox.r - pfr.left) + 10);
      if (rightBox) safe.right = Math.max(safe.right, safeNum(pfr.right - rightBox.l) + 10);

      // Special: cVR crosshair/vr-ui buttons are usually at top-left; reserve a bit more on top
      try{
        if (DOC.body.classList.contains('view-cvr')){
          safe.top = Math.max(safe.top, 64);
        }
      }catch(_){}
    }

    // Cap so we never kill play space
    safe.top = clamp(safe.top, basePad, Math.max(basePad, pfr.height * 0.45));
    safe.bottom = clamp(safe.bottom, basePad, Math.max(basePad, pfr.height * 0.45));
    safe.left = clamp(safe.left, basePad, Math.max(basePad, pfr.width * 0.45));
    safe.right = clamp(safe.right, basePad, Math.max(basePad, pfr.width * 0.45));

    // expose globally
    WIN.HHA_SAFE = safe;

    // Also export CSS vars for debugging/optional use
    try{
      DOC.documentElement.style.setProperty('--hha-safe-top', safe.top+'px');
      DOC.documentElement.style.setProperty('--hha-safe-right', safe.right+'px');
      DOC.documentElement.style.setProperty('--hha-safe-bottom', safe.bottom+'px');
      DOC.documentElement.style.setProperty('--hha-safe-left', safe.left+'px');
    }catch(_){}

    // optional event
    try{
      WIN.dispatchEvent(new CustomEvent('hha:safe', { detail: safe }));
    }catch(_){}
  }

  // Run with debounce
  let t=null;
  function schedule(){
    if (t) clearTimeout(t);
    t = setTimeout(computeSafe, 90);
  }

  WIN.addEventListener('resize', schedule);
  WIN.addEventListener('orientationchange', schedule);
  DOC.addEventListener('fullscreenchange', schedule);
  WIN.addEventListener('pageshow', schedule);

  // If HUD changes (class toggles), we can re-measure periodically short time
  let pulseN=0;
  function pulse(){
    pulseN++;
    computeSafe();
    if (pulseN < 12) setTimeout(pulse, 220);
  }

  // init
  computeSafe();
  pulse();
})();