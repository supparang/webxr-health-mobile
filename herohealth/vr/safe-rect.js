// === /herohealth/vr/safe-rect.js ===
// HHA SafeRect + Auto Safe Zone (HUD/VRUI) + Debug box
// PRODUCTION v20260223
'use strict';

/**
 * createSafeRectKit({
 *   doc, win,
 *   layerEl,         // required: main play layer (#gj-layer, #plate-layer, ...)
 *   hudSel,          // optional: selector for HUD root
 *   extraTopSel,     // optional: selector(s) for extra top overlays (boss bar etc.)
 *   bottomSel,       // optional: selector(s) for VR UI bar/buttons
 *   varTop, varBottom, varEdge,
 *   defaultTopPx, defaultBottomPx,
 *   debug            // boolean or ?debug=1
 * })
 *
 * Returns:
 * - measure()  => recompute CSS vars
 * - getSafeRect(layerRectProvider?) => {W,H,xMin,xMax,yMin,yMax,left,top}
 * - renderDebug() => draw safe area box when debug enabled
 */
export function createSafeRectKit(opts = {}){
  const DOC = opts.doc || document;
  const WIN = opts.win || window;
  const layerEl = opts.layerEl;

  if(!layerEl) throw new Error('[safe-rect] layerEl is required');

  const hudSel = String(opts.hudSel || '');
  const extraTopSel = Array.isArray(opts.extraTopSel) ? opts.extraTopSel : (opts.extraTopSel ? [opts.extraTopSel] : []);
  const bottomSel = Array.isArray(opts.bottomSel) ? opts.bottomSel : (opts.bottomSel ? [opts.bottomSel] : []);

  const varTop = String(opts.varTop || '--gj-top-safe');
  const varBottom = String(opts.varBottom || '--gj-bottom-safe');
  const varEdge = String(opts.varEdge || '--gj-edge-pad');

  const defaultTopPx = Number(opts.defaultTopPx ?? 160);
  const defaultBottomPx = Number(opts.defaultBottomPx ?? 140);
  const defaultEdgePx = Number(opts.defaultEdgePx ?? 12);

  const debug = !!opts.debug;

  const qs = (k, def=null)=>{ try { return new URL(WIN.location.href).searchParams.get(k) ?? def; } catch { return def; } };

  function setRootPxVar(name, px){
    try{
      const n = Math.max(0, Math.round(Number(px) || 0));
      DOC.documentElement.style.setProperty(name, `${n}px`);
    }catch(_){}
  }

  function readRootPxVar(name, fallbackPx){
    try{
      const cs = getComputedStyle(DOC.documentElement);
      const v = String(cs.getPropertyValue(name) || '').trim().replace('px','');
      const n = Number(v);
      return Number.isFinite(n) ? n : fallbackPx;
    }catch(_){
      return fallbackPx;
    }
  }

  function layerRect(){
    try{
      const r = layerEl.getBoundingClientRect();
      if(r && r.width > 10 && r.height > 10) return r;
    }catch(_){}
    return { left:0, top:0, width:DOC.documentElement.clientWidth, height:DOC.documentElement.clientHeight };
  }

  // ---------- Debug box ----------
  function ensureDebugBox(){
    if(!debug) return null;
    try{
      let el = DOC.getElementById('hha-debug-safe');
      if(el) return el;

      el = DOC.createElement('div');
      el.id = 'hha-debug-safe';
      el.style.position = 'absolute';
      el.style.zIndex = '9999';
      el.style.pointerEvents = 'none';
      el.style.border = '2px dashed rgba(34,211,238,.95)';
      el.style.boxShadow = '0 0 0 9999px rgba(0,0,0,.12) inset';
      el.style.borderRadius = '12px';

      const tag = DOC.createElement('div');
      tag.textContent = 'SAFE SPAWN AREA';
      tag.style.position = 'absolute';
      tag.style.left = '10px';
      tag.style.top  = '10px';
      tag.style.fontWeight = '900';
      tag.style.fontSize = '12px';
      tag.style.letterSpacing = '.2px';
      tag.style.padding = '6px 10px';
      tag.style.borderRadius = '999px';
      tag.style.border = '1px solid rgba(34,211,238,.45)';
      tag.style.background = 'rgba(2,6,23,.65)';
      tag.style.color = 'rgba(229,231,235,.95)';
      tag.style.backdropFilter = 'blur(8px)';
      el.appendChild(tag);

      layerEl.appendChild(el);
      return el;
    }catch(_){
      return null;
    }
  }

  function getSafeRect(){
    const r = layerRect();
    const W = Math.floor(r.width);
    const H = Math.floor(r.height);

    const sat = readRootPxVar('--sat', 0);
    const topSafe = readRootPxVar(varTop, defaultTopPx + sat);
    const botSafe = readRootPxVar(varBottom, defaultBottomPx);

    const edge = readRootPxVar(varEdge, defaultEdgePx);

    const xMin = Math.floor(W * 0.10);
    const xMax = Math.floor(W * 0.90);
    const yMin = Math.floor(Math.min(H-80, Math.max(20, topSafe)));
    const yMax = Math.floor(Math.max(yMin + 120, H - botSafe));

    // apply edge pad
    return {
      W, H,
      xMin: xMin + edge,
      xMax: xMax - edge,
      yMin: yMin + edge,
      yMax: yMax - edge,
      left: r.left,
      top: r.top
    };
  }

  function renderDebug(){
    if(!debug) return;
    const el = ensureDebugBox();
    if(!el) return;

    const sr = getSafeRect();
    const x1 = Math.max(0, Math.floor(sr.xMin));
    const x2 = Math.max(0, Math.floor(sr.xMax));
    const y1 = Math.max(0, Math.floor(sr.yMin));
    const y2 = Math.max(0, Math.floor(sr.yMax));

    el.style.left = `${x1}px`;
    el.style.top  = `${y1}px`;
    el.style.width  = `${Math.max(10, x2 - x1)}px`;
    el.style.height = `${Math.max(10, y2 - y1)}px`;
  }

  function measure(){
    try{
      let topSafe = 0;

      if(hudSel){
        const hud = DOC.querySelector(hudSel);
        if(hud){
          const r = hud.getBoundingClientRect();
          if(r && r.height > 0) topSafe = Math.max(topSafe, r.bottom);
        }
      }

      for(const sel of extraTopSel){
        const el = DOC.querySelector(sel);
        if(!el) continue;
        if(el.getAttribute && el.getAttribute('aria-hidden') === 'true') continue;
        const r = el.getBoundingClientRect();
        if(r && r.height > 0) topSafe = Math.max(topSafe, r.bottom);
      }

      topSafe = (topSafe || defaultTopPx) + 14;

      let bottomSafe = 0;

      const cand = [
        '#vr-ui', '#vrui', '#hha-vrui', '.vr-ui', '.vrui', '.hha-vrui',
        ...bottomSel,
        'button[aria-label="ENTER VR"]',
        'button[aria-label="RECENTER"]'
      ];

      for(const sel of cand){
        const el = DOC.querySelector(sel);
        if(!el) continue;
        const r = el.getBoundingClientRect();
        if(!r || r.height <= 0) continue;

        const vh = DOC.documentElement.clientHeight || WIN.innerHeight || 0;
        const distFromBottom = Math.max(0, vh - r.top);
        bottomSafe = Math.max(bottomSafe, distFromBottom);
      }

      bottomSafe = Math.max(bottomSafe, defaultBottomPx);

      setRootPxVar(varTop, topSafe);
      setRootPxVar(varBottom, bottomSafe);
      setRootPxVar(varEdge, defaultEdgePx);

      renderDebug();
    }catch(_){}
  }

  function bind(){
    WIN.addEventListener('resize', ()=>{ measure(); }, { passive:true });
    WIN.addEventListener('orientationchange', ()=>{ setTimeout(measure, 220); }, { passive:true });
  }

  // auto-bind + initial measure
  bind();
  setTimeout(measure, 0);
  setTimeout(measure, 120);
  setTimeout(measure, 420);

  return { measure, getSafeRect, renderDebug, readRootPxVar, setRootPxVar, qs };
}