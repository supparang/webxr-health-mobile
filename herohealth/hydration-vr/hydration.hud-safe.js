// === /herohealth/hydration-vr/hydration.hud-safe.js ===
// Hydration HUD-SAFE spawn helper — PRODUCTION
// ✅ Computes safe spawn area inside playfield while avoiding HUD overlay rects
// ✅ Works for PC/Mobile/cVR/Cardboard (playfieldSelector differs)
// ✅ Auto-relax when playfield too small or HUD covers too much
// ✅ Optional debug overlay: localStorage.HHA_DEBUG_SAFE = "1"

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

function rectOf(el){
  try{
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    if (!r || !(r.width>0 && r.height>0)) return null;
    return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
  }catch(_){ return null; }
}

function intersects(a,b){
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function inflate(r, pad){
  return {
    left: r.left - pad,
    top: r.top - pad,
    right: r.right + pad,
    bottom: r.bottom + pad,
    width: r.width + pad*2,
    height: r.height + pad*2
  };
}

function pointInRect(x,y,r){
  return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}

// Merge overlapping rects (simple O(n^2) union-ish)
function mergeRects(rects){
  const out = [];
  for (const r0 of rects){
    if (!r0) continue;
    let r = {...r0};
    let merged = false;
    for (let i=0;i<out.length;i++){
      const a = out[i];
      // if overlap (or near), merge
      const near = inflate(a, 6);
      if (intersects(near, r)){
        out[i] = {
          left: Math.min(a.left, r.left),
          top: Math.min(a.top, r.top),
          right: Math.max(a.right, r.right),
          bottom: Math.max(a.bottom, r.bottom),
          width: 0,
          height: 0
        };
        out[i].width = out[i].right - out[i].left;
        out[i].height = out[i].bottom - out[i].top;
        merged = true;
        break;
      }
    }
    if (!merged){
      r.width = r.right - r.left;
      r.height = r.bottom - r.top;
      out.push(r);
    }
  }
  return out;
}

export function createHudSafezone(opts = {}){
  const DOC = document;

  const CFG = Object.assign({
    playfieldSelector: '#playfield',
    hudSelector: '.hud',
    pad: 22,         // inner padding inside playfield
    hudPad: 14,      // extra padding around HUD rects (so targets don't kiss edges)
    minW: 240,
    minH: 240
  }, opts || {});

  let debug = false;
  let debugEl = null;
  let last = { pf:null, huds:[], safe:null };

  function getPlayfieldEl(){
    return DOC.querySelector(CFG.playfieldSelector);
  }
  function getHudEls(){
    // capture hud root + notable children (buttons/quest panels/etc.)
    const hudRoot = DOC.querySelector(CFG.hudSelector);
    if (!hudRoot) return [];
    const els = [hudRoot, ...hudRoot.querySelectorAll('*')];
    // keep only elements that have box & are visible-ish
    return els.filter(el=>{
      try{
        const st = getComputedStyle(el);
        if (st.display==='none' || st.visibility==='hidden' || Number(st.opacity||'1')<=0.02) return false;
        if (st.pointerEvents==='none' && el !== hudRoot) return false; // ignore non-interactive tiny spans
        const r = el.getBoundingClientRect();
        return r && r.width>6 && r.height>6;
      }catch(_){ return false; }
    });
  }

  function compute(){
    const pf = getPlayfieldEl();
    const pfRect = rectOf(pf);
    if (!pfRect) return null;

    const pad = CFG.pad;
    const inner = {
      left: pfRect.left + pad,
      top: pfRect.top + pad,
      right: pfRect.right - pad,
      bottom: pfRect.bottom - pad
    };
    inner.width = Math.max(1, inner.right - inner.left);
    inner.height = Math.max(1, inner.bottom - inner.top);

    // collect hud rects that intersect playfield area
    let hudRects = [];
    const hudEls = getHudEls();
    for (const el of hudEls){
      const r = rectOf(el);
      if (!r) continue;
      // must intersect playfield to matter
      if (!intersects(r, pfRect)) continue;
      hudRects.push(inflate(r, CFG.hudPad));
    }
    hudRects = mergeRects(hudRects);

    // Decide "safeRect" baseline: inner playfield
    // If HUD covers huge area, we still allow spawn by sampling+rejecting against hudRects.
    // But we can also try to carve out a safe band if HUD mainly sits at top/bottom.
    const safe = { ...inner };

    // relax logic: if playfield too small, lower hudPad and pad
    const tiny = (pfRect.width < CFG.minW || pfRect.height < CFG.minH);
    const relax = tiny ? 1 : 0;

    last = { pf:pfRect, huds:hudRects, safe, relax };

    return { pfRect, inner, hudRects, safe, relax };
  }

  function pickXY(rngFn){
    const rng = typeof rngFn === 'function' ? rngFn : Math.random;
    const data = compute();
    if (!data) return { xPct:50, yPct:50 };

    const { pfRect, inner, hudRects, relax } = data;

    // when relax: shrink hud padding effect
    const localHudRects = relax ? hudRects.map(r=>inflate(r, -Math.min(CFG.hudPad-2, 10))) : hudRects;

    // rejection sampling inside inner rect
    // try many times, then progressively relax (allow closer to HUD) to avoid "spawn at one spot"
    const maxTry = 90;
    let ok = null;

    for (let i=0;i<maxTry;i++){
      const rx = (rng()+rng())/2; // center-biased
      const ry = (rng()+rng())/2;
      const x = inner.left + rx * inner.width;
      const y = inner.top + ry * inner.height;

      // Check not in any HUD rect
      let blocked = false;
      for (const hr of localHudRects){
        if (pointInRect(x,y,hr)){ blocked = true; break; }
      }

      // progressive relax: after 45 tries, ignore smallest hud rects; after 70 tries, accept anything
      if (blocked){
        if (i > 45){
          // ignore tiny hud blocks
          const bigOnly = localHudRects.filter(r=>(r.width*r.height) > 12000);
          blocked = false;
          for (const hr of bigOnly){
            if (pointInRect(x,y,hr)){ blocked = true; break; }
          }
        }
        if (i > 70) blocked = false;
      }

      if (!blocked){
        ok = { x, y };
        break;
      }
    }

    // fallback: center of inner
    if (!ok){
      ok = {
        x: inner.left + inner.width/2,
        y: inner.top + inner.height/2
      };
    }

    // convert to % of playfield rect (NOT inner)
    const xPct = ((ok.x - pfRect.left)/Math.max(1,pfRect.width))*100;
    const yPct = ((ok.y - pfRect.top)/Math.max(1,pfRect.height))*100;

    return {
      xPct: clamp(xPct, 2, 98),
      yPct: clamp(yPct, 2, 98)
    };
  }

  function ensureDebugEl(){
    if (debugEl && debugEl.isConnected) return debugEl;
    const el = DOC.createElement('div');
    el.id = 'hha-safe-debug';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9998; pointer-events:none;
      font-family:system-ui; color:#e5e7eb;
    `;
    el.innerHTML = `
      <div style="position:absolute;left:10px;bottom:10px;background:rgba(2,6,23,.72);border:1px solid rgba(148,163,184,.22);border-radius:12px;padding:8px 10px;font-size:12px;line-height:1.35">
        <div style="font-weight:800">SAFE SPAWN DEBUG</div>
        <div style="opacity:.85">playfield: <span id="hhaD_pf">-</span></div>
        <div style="opacity:.85">huds: <span id="hhaD_hud">-</span></div>
        <div style="opacity:.85">relax: <span id="hhaD_rx">-</span></div>
        <div style="opacity:.75;margin-top:4px">ปิด: localStorage.removeItem('HHA_DEBUG_SAFE')</div>
      </div>
      <div id="hhaD_layer" style="position:absolute;inset:0;"></div>
    `;
    DOC.body.appendChild(el);
    debugEl = el;
    return el;
  }

  function renderDebug(){
    try{
      debug = String(localStorage.getItem('HHA_DEBUG_SAFE')||'') === '1';
    }catch(_){ debug=false; }

    if (!debug){
      if (debugEl) { try{ debugEl.remove(); }catch(_){ } }
      debugEl = null;
      return;
    }

    const el = ensureDebugEl();
    const layer = el.querySelector('#hhaD_layer');
    if (!layer) return;

    // compute latest & draw rects
    const data = compute();
    if (!data) return;

    const { pfRect, inner, hudRects, relax } = data;

    el.querySelector('#hhaD_pf').textContent = `${Math.round(pfRect.width)}x${Math.round(pfRect.height)}`;
    el.querySelector('#hhaD_hud').textContent = String(hudRects.length);
    el.querySelector('#hhaD_rx').textContent = relax ? 'YES' : 'NO';

    // clear & draw
    layer.innerHTML = '';

    function box(r, stroke, fill, label){
      const b = DOC.createElement('div');
      b.style.cssText = `
        position:fixed;
        left:${r.left}px; top:${r.top}px;
        width:${Math.max(1,r.right-r.left)}px;
        height:${Math.max(1,r.bottom-r.top)}px;
        border:2px solid ${stroke};
        background:${fill};
        border-radius:10px;
        box-sizing:border-box;
      `;
      if (label){
        const t = DOC.createElement('div');
        t.textContent = label;
        t.style.cssText = `position:absolute;left:6px;top:4px;font-size:11px;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.35)`;
        b.appendChild(t);
      }
      layer.appendChild(b);
    }

    box(pfRect, 'rgba(34,211,238,.75)', 'rgba(34,211,238,.06)', 'PLAYFIELD');
    box(inner,  'rgba(34,197,94,.75)', 'rgba(34,197,94,.06)', 'INNER');
    hudRects.forEach((r,i)=>box(r, 'rgba(249,115,115,.75)', 'rgba(249,115,115,.08)', i===0?'HUD':'' ));
  }

  // auto re-render debug on resize/orientation/fullscreen
  let dbgT = 0;
  function scheduleDebug(){
    const now = performance.now();
    if (now - dbgT < 120) return;
    dbgT = now;
    renderDebug();
  }
  window.addEventListener('resize', scheduleDebug);
  window.addEventListener('orientationchange', scheduleDebug);
  document.addEventListener('fullscreenchange', scheduleDebug);

  // initial
  setTimeout(renderDebug, 60);

  return {
    pickXY,
    compute,
    renderDebug
  };
}