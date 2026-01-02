// === /herohealth/vr/vr-runtime.js ===
// HeroHealth VR Runtime Helper (Pack 12)
// ✅ view classes + safe margins + layer offset + aim point
// ✅ fullscreen + orientation helpers (best-effort; user gesture)
// ✅ view-cvr strict: crosshair shooting via hha:shoot, targets pointer-events off
// ✅ prevent HUD blocking VR UI (z-index + pointer-events)
// Usage: HHA_VR_RUNTIME.init({ view, stageSel, layerSel, targetSel, lockPx })

(function(ROOT){
  'use strict';

  const DOC = ROOT.document;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-'+view);
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v==='pc') return 'pc';
    if (v==='vr') return 'vr';
    if (v==='cvr') return 'cvr';
    return 'mobile';
  }

  // ---------- Fullscreen / Orientation ----------
  async function ensureFullscreen(){
    try{
      if (!DOC.fullscreenElement && DOC.documentElement.requestFullscreen){
        await DOC.documentElement.requestFullscreen();
        DOC.body.classList.add('is-fs');
      }
    }catch(_){}
  }
  async function lockLandscape(){
    try{
      if (ROOT.screen && screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }
  function onFsChange(){
    DOC.body.classList.toggle('is-fs', !!DOC.fullscreenElement);
  }

  // ---------- Safe margins (for engines) ----------
  function calcSafeMargins(opts={}){
    // Try to reserve top for VRUI buttons & HUD, bottom for fever/controls
    // Use CSS vars if present; fallback conservative
    const cs = getComputedStyle(DOC.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const hudH = parseFloat(cs.getPropertyValue('--hudH')) || 220;
    const feverH = parseFloat(cs.getPropertyValue('--feverH')) || 92;
    const ctrlH  = parseFloat(cs.getPropertyValue('--ctrlH')) || 92;

    const view = opts.view || normalizeView(qs('view','mobile'));

    // In VR/cVR you often collapse HUD, but still keep a small top margin for VRUI
    const topBase = (view==='vr' || view==='cvr') ? (sat + 64) : (sat + hudH);
    const bottomBase = sab + ctrlH + feverH + 10;

    return {
      top: clamp(topBase, 40, 420),
      bottom: clamp(bottomBase, 60, 520),
      left: 26,
      right: 26
    };
  }

  function computeStageOffset(stageSel){
    const stage = stageSel ? DOC.querySelector(stageSel) : null;
    if (!stage) return { x:0, y:0 };
    const r = stage.getBoundingClientRect();
    return { x: r.left|0, y: r.top|0 };
  }

  function computeAimPoint(stageSel){
    // aim point: center of STAGE (not whole screen) + slightly lower for comfort
    const stage = stageSel ? DOC.querySelector(stageSel) : null;
    if (!stage) return { x:(innerWidth*0.5)|0, y:(innerHeight*0.62)|0 };
    const r = stage.getBoundingClientRect();
    return { x:(r.left + r.width*0.5)|0, y:(r.top + r.height*0.58)|0 };
  }

  // ---------- Prevent HUD blocking VR UI ----------
  function applyNoBlockCss(){
    // Minimal guard if CSS was inconsistent in some pages
    if (DOC.getElementById('hha-vr-runtime-style')) return;

    const st = DOC.createElement('style');
    st.id = 'hha-vr-runtime-style';
    st.textContent = `
      /* HUD never blocks playfield */
      .hha-hud, .hha-fever { pointer-events: none !important; }
      .hha-hud .pill, .hha-hud button, .hha-hud a { pointer-events: auto; }

      /* VR UI must be on top */
      .hha-vrui, .hha-vr-ui, #hha-vrui { z-index: 200 !important; }

      /* If any overlay exists, keep it below VRUI by default */
      .start-overlay, .vr-hint, .gj-peek { z-index: 120; }

      /* In cVR strict mode, disable pointer events on targets (generic) */
      body.view-cvr .gj-target,
      body.view-cvr .hha-target,
      body.view-cvr .target { pointer-events: none !important; }
    `;
    DOC.head.appendChild(st);
  }

  // ---------- view-cvr strict: shoot from crosshair ----------
  function nearestTarget(layerEl, targetSel, xLayer, yLayer, lockPx){
    if (!layerEl) return null;
    const targets = layerEl.querySelectorAll(targetSel);
    if (!targets || !targets.length) return null;

    const maxD2 = (lockPx*lockPx);
    let best = null;
    let bestD2 = maxD2;

    for (const el of targets){
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width*0.5;
      const cy = r.top  + r.height*0.5;

      // convert to layer coords using global layer offset
      const ox = (ROOT.__HHA_LAYER_OFFSET__?.x || 0);
      const oy = (ROOT.__HHA_LAYER_OFFSET__?.y || 0);
      const lx = cx - ox;
      const ly = cy - oy;

      const dx = lx - xLayer;
      const dy = ly - yLayer;
      const d2 = dx*dx + dy*dy;

      if (d2 <= bestD2){
        bestD2 = d2;
        best = el;
      }
    }
    return best;
  }

  function dispatchHit(el){
    if (!el) return false;
    try{
      // Prefer pointerdown like your engines
      const ev = new PointerEvent('pointerdown', { bubbles:true, cancelable:true, pointerType:'mouse' });
      el.dispatchEvent(ev);
      return true;
    }catch(_){
      try{
        el.click();
        return true;
      }catch(_2){}
    }
    return false;
  }

  function bindCvrShooting(opts){
    const layerSel = opts.layerSel || '#gj-layer';
    const targetSel = opts.targetSel || '.gj-target';
    const lockPx = clamp(opts.lockPx ?? 90, 30, 220);

    const layer = DOC.querySelector(layerSel);
    if (!layer) return;

    ROOT.addEventListener('hha:shoot', (ev)=>{
      // ev.detail is screen coords from VRUI
      const sx = ev?.detail?.x ?? (innerWidth*0.5);
      const sy = ev?.detail?.y ?? (innerHeight*0.5);

      const off = ROOT.__HHA_LAYER_OFFSET__ || { x:0, y:0 };
      const xL = (sx - off.x);
      const yL = (sy - off.y);

      const hit = nearestTarget(layer, targetSel, xL, yL, lockPx);
      if (hit) dispatchHit(hit);
    }, { passive:true });
  }

  // ---------- Public init ----------
  async function init(opts={}){
    const view = normalizeView(opts.view || qs('view','mobile'));
    setBodyView(view);

    // Apply no-block CSS guards
    applyNoBlockCss();

    // Track fullscreen changes
    DOC.addEventListener('fullscreenchange', onFsChange, { passive:true });

    // Compute global offsets for engines that rely on screen->layer mapping
    const stageSel = opts.stageSel || '#gj-stage';
    const off = computeStageOffset(stageSel);
    const aim = computeAimPoint(stageSel);

    ROOT.__HHA_LAYER_OFFSET__ = off;      // used by helper + can be used by engines
    ROOT.__HHA_AIM_POINT__ = aim;

    // Provide safe margins for engines that accept safeMargins
    ROOT.__HHA_SAFE_MARGINS__ = calcSafeMargins({ view });

    // Enter CVR hook: preload VR UI etc.
    if (view === 'cvr'){
      try{ ROOT.dispatchEvent(new CustomEvent('hha:enter-cvr')); }catch(_){}
      bindCvrShooting({
        layerSel: opts.layerSel || '#gj-layer',
        targetSel: opts.targetSel || '.gj-target',
        lockPx: opts.lockPx ?? 96
      });
    }

    // VR: best-effort helpers (must be called under user gesture; so we expose actions)
    return {
      view,
      safeMargins: ROOT.__HHA_SAFE_MARGINS__,
      layerOffset: off,
      aimPoint: aim,
      requestFullscreen: ensureFullscreen,
      requestLandscape: lockLandscape
    };
  }

  ROOT.HHA_VR_RUNTIME = { init };

})(window);