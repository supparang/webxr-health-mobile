// === /herohealth/vr/spawn-guard.js ===
// HHA Spawn Guard — Auto safe spawn area (HUD-safe)
// v20260301-SPAWNGUARD
'use strict';

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rectUnion(a,b){
  if(!a) return b;
  if(!b) return a;
  const x1 = Math.min(a.left, b.left);
  const y1 = Math.min(a.top,  b.top);
  const x2 = Math.max(a.right,b.right);
  const y2 = Math.max(a.bottom,b.bottom);
  return { left:x1, top:y1, right:x2, bottom:y2, width:x2-x1, height:y2-y1 };
}

function getPxVar(name, fallback=0){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }catch(e){ return fallback; }
}

/**
 * createSpawnGuard(opts)
 * opts:
 *  - hudSelector: default '.hud'
 *  - layerEl: element where targets are placed (optional)
 *  - margin: px (default 12)
 *  - minTop: px additional top safe (optional)
 *  - debug: boolean
 */
export function createSpawnGuard(opts={}){
  const hudSelector = opts.hudSelector || '.hud';
  const margin = Number(opts.margin ?? 12);
  const minTop = Number(opts.minTop ?? 0);
  const debug = !!opts.debug;

  const st = {
    hudRect: null,
    safeRect: null,
    vw: 0,
    vh: 0,
    lastTs: 0
  };

  function measure(){
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    // Safe-area insets (CSS env → may not be readable; use fallback vars if set)
    const insetTop    = getPxVar('--safe-top', 0);
    const insetBottom = getPxVar('--safe-bottom', 0);
    const insetLeft   = getPxVar('--safe-left', 0);
    const insetRight  = getPxVar('--safe-right', 0);

    let hudRect = null;
    try{
      const hud = document.querySelector(hudSelector);
      if(hud){
        const r = hud.getBoundingClientRect();
        // ignore if hidden or 0-size
        if(r.width > 10 && r.height > 10) hudRect = r;
      }
    }catch(e){}

    // Base safe rect: whole viewport minus margins/insets
    let safe = {
      left: margin + insetLeft,
      top:  margin + insetTop,
      right: vw - margin - insetRight,
      bottom: vh - margin - insetBottom
    };

    // Extra top (optional)
    safe.top = Math.max(safe.top, minTop);

    // Exclude HUD area (top overlay)
    if(hudRect){
      // If HUD overlaps top area, push safe.top down to below HUD
      // Add a little gap so targets don't "kiss" the HUD edge
      safe.top = Math.max(safe.top, hudRect.bottom + margin);
    }

    safe.left = clamp(safe.left, 0, vw);
    safe.right = clamp(safe.right, 0, vw);
    safe.top = clamp(safe.top, 0, vh);
    safe.bottom = clamp(safe.bottom, 0, vh);

    // Ensure non-negative
    if(safe.right < safe.left + 20){ safe.left = 10; safe.right = vw - 10; }
    if(safe.bottom < safe.top + 40){ safe.top = 10; safe.bottom = vh - 10; }

    st.vw = vw; st.vh = vh;
    st.hudRect = hudRect;
    st.safeRect = { ...safe, width: safe.right-safe.left, height: safe.bottom-safe.top };

    if(debug){
      drawDebug();
    }
  }

  // Convert normalized x01/y01 (0..1) into safe px, then back to normalized
  function clamp01(x01,y01){
    if(!st.safeRect) measure();
    const r = st.safeRect;
    const vw = st.vw || window.innerWidth;
    const vh = st.vh || window.innerHeight;

    x01 = clamp(x01, 0, 1);
    y01 = clamp(y01, 0, 1);

    const x = x01 * vw;
    const y = y01 * vh;

    const cx = clamp(x, r.left, r.right);
    const cy = clamp(y, r.top,  r.bottom);

    return { x01: clamp(cx / vw, 0, 1), y01: clamp(cy / vh, 0, 1) };
  }

  // Random point in safe rect (normalized)
  function random01(rng=Math.random){
    if(!st.safeRect) measure();
    const r = st.safeRect;
    const vw = st.vw || window.innerWidth;
    const vh = st.vh || window.innerHeight;
    const x = r.left + (r.width * rng());
    const y = r.top  + (r.height * rng());
    return { x01: clamp(x / vw, 0, 1), y01: clamp(y / vh, 0, 1) };
  }

  // optional debug overlay
  let dbgEl = null;
  function drawDebug(){
    try{
      if(!dbgEl){
        dbgEl = document.createElement('div');
        dbgEl.style.position = 'fixed';
        dbgEl.style.left = '0';
        dbgEl.style.top = '0';
        dbgEl.style.right = '0';
        dbgEl.style.bottom = '0';
        dbgEl.style.pointerEvents = 'none';
        dbgEl.style.zIndex = '9997';
        document.body.appendChild(dbgEl);
      }
      const r = st.safeRect;
      if(!r) return;

      dbgEl.innerHTML = `
        <div style="position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;
          border:2px dashed rgba(0,255,180,.75); border-radius:12px; box-sizing:border-box;"></div>
      `;
    }catch(e){}
  }

  // throttle measure
  function tick(force=false){
    const now = Date.now();
    if(force || (now - st.lastTs > 250)){
      st.lastTs = now;
      measure();
    }
  }

  // init + listeners
  measure();
  window.addEventListener('resize', ()=>tick(true), { passive:true });
  window.addEventListener('orientationchange', ()=>setTimeout(()=>tick(true), 120), { passive:true });

  return {
    measure,
    tick,
    clamp01,
    random01,
    getSafeRect: ()=>st.safeRect,
    getHudRect: ()=>st.hudRect
  };
}

export default { createSpawnGuard };