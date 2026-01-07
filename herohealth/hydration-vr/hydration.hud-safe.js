// === /herohealth/hydration-vr/hydration.hud-safe.js ===
// HUD-SAFE Spawn Helper — PRODUCTION
// ✅ Compute safe play-rect excluding HUD panels (best-effort, responsive)
// ✅ Works for PC/Mobile/cVR
// ✅ Debug overlay toggle (no URL override): localStorage HHA_DEBUG_SAFE=1
// ✅ Recomputes on resize/orientation/fullscreen

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }

function rectOf(el){
  const r = el?.getBoundingClientRect?.();
  if (!r) return null;
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
}

function isVisiblePanelRect(r){
  if (!r) return false;
  if (r.width < 8 || r.height < 8) return false;
  if (!isFinite(r.left+r.top+r.right+r.bottom)) return false;
  return true;
}

function computeCuts(playRect, panelRects){
  const pr = playRect;
  const cx = pr.left + pr.width/2;
  const cy = pr.top + pr.height/2;

  let topCut=0, bottomCut=0, leftCut=0, rightCut=0;

  // heuristic bands
  const topBandY = pr.top + pr.height*0.38;
  const botBandY = pr.top + pr.height*0.62;
  const leftBandX = pr.left + pr.width*0.38;
  const rightBandX = pr.left + pr.width*0.62;

  for (const r of panelRects){
    if (!isVisiblePanelRect(r)) continue;

    // top panels
    if (r.top <= topBandY){
      topCut = Math.max(topCut, clamp(r.bottom - pr.top, 0, pr.height));
    }
    // bottom panels
    if (r.bottom >= botBandY){
      bottomCut = Math.max(bottomCut, clamp(pr.bottom - r.top, 0, pr.height));
    }

    // left panels (ignore huge overlays)
    if (r.left <= leftBandX && r.width < pr.width*0.75){
      leftCut = Math.max(leftCut, clamp(r.right - pr.left, 0, pr.width));
    }
    // right panels
    if (r.right >= rightBandX && r.width < pr.width*0.75){
      rightCut = Math.max(rightCut, clamp(pr.right - r.left, 0, pr.width));
    }
  }

  // soften: don't over-cut the center (keeps play area usable)
  const maxSide = pr.width*0.42;
  const maxTop  = pr.height*0.42;
  const maxBot  = pr.height*0.42;

  leftCut  = clamp(leftCut, 0, maxSide);
  rightCut = clamp(rightCut, 0, maxSide);
  topCut   = clamp(topCut, 0, maxTop);
  bottomCut= clamp(bottomCut, 0, maxBot);

  // If cuts would crush the center, relax them proportionally
  const remW = pr.width - leftCut - rightCut;
  const remH = pr.height - topCut - bottomCut;

  if (remW < pr.width*0.42){
    const over = (pr.width*0.42 - remW);
    leftCut  = Math.max(0, leftCut - over*0.5);
    rightCut = Math.max(0, rightCut - over*0.5);
  }
  if (remH < pr.height*0.42){
    const over = (pr.height*0.42 - remH);
    topCut    = Math.max(0, topCut - over*0.5);
    bottomCut = Math.max(0, bottomCut - over*0.5);
  }

  return { topCut, bottomCut, leftCut, rightCut, cx, cy };
}

function ensureDebugLayer(){
  let el = DOC.getElementById('hha-safe-debug');
  if (el) return el;
  el = DOC.createElement('div');
  el.id = 'hha-safe-debug';
  el.style.cssText = `
    position:fixed; inset:0; z-index:200;
    pointer-events:none; display:none;
  `;
  el.innerHTML = `
    <div id="hha-safe-pr" style="position:absolute;border:2px dashed rgba(34,211,238,.55);border-radius:16px;"></div>
    <div id="hha-safe-sr" style="position:absolute;border:2px solid rgba(34,197,94,.55);border-radius:16px;"></div>
    <div id="hha-safe-dot" style="position:absolute;width:10px;height:10px;border-radius:999px;background:rgba(245,158,11,.95);transform:translate(-50%,-50%);"></div>
    <div id="hha-safe-label" style="
      position:absolute; left:12px; top:12px;
      font: 800 12px/1.25 system-ui;
      color: rgba(229,231,235,.95);
      background: rgba(2,6,23,.75);
      border:1px solid rgba(148,163,184,.18);
      border-radius:12px;
      padding:8px 10px;
      max-width:min(560px, calc(100% - 24px));
      white-space:pre-line;
    "></div>
  `;
  DOC.body.appendChild(el);
  return el;
}

function setRectBox(id, r){
  const el = DOC.getElementById(id);
  if (!el || !r) return;
  el.style.left = r.left + 'px';
  el.style.top  = r.top + 'px';
  el.style.width  = Math.max(0, r.width) + 'px';
  el.style.height = Math.max(0, r.height) + 'px';
}

function setDot(id, x, y){
  const el = DOC.getElementById(id);
  if (!el) return;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
}

function setLabel(text){
  const el = DOC.getElementById('hha-safe-label');
  if (!el) return;
  el.textContent = String(text || '');
}

export function createHudSafezone(opts = {}){
  const playfieldSelector = String(opts.playfieldSelector || '#playfield');
  const hudSelector = String(opts.hudSelector || '.hud');
  const pad = clamp(opts.pad ?? 22, 8, 80);
  const minW = clamp(opts.minW ?? 220, 120, 800);
  const minH = clamp(opts.minH ?? 220, 120, 800);

  let lastSafe = null;

  function getRects(){
    const pf = DOC.querySelector(playfieldSelector);
    const hud = DOC.querySelector(hudSelector);

    const pr = rectOf(pf) || { left:0, top:0, right:1, bottom:1, width:1, height:1 };
    const panels = hud ? Array.from(hud.querySelectorAll('.panel')) : [];
    const panelRects = panels.map(rectOf).filter(Boolean);

    return { pf, hud, pr, panelRects };
  }

  function compute(){
    const { pr, panelRects } = getRects();

    const cuts = computeCuts(pr, panelRects);

    const left  = pr.left + cuts.leftCut + pad;
    const top   = pr.top  + cuts.topCut  + pad;
    const right = pr.right - cuts.rightCut - pad;
    const bottom= pr.bottom- cuts.bottomCut- pad;

    let w = right - left;
    let h = bottom - top;

    // If too small, relax to centered safe area
    if (w < minW || h < minH){
      const cx = pr.left + pr.width/2;
      const cy = pr.top + pr.height/2;
      const ww = Math.max(minW, pr.width*0.55);
      const hh = Math.max(minH, pr.height*0.55);
      w = Math.min(pr.width - pad*2, ww);
      h = Math.min(pr.height - pad*2, hh);
      lastSafe = {
        playRect: pr,
        safeRect: {
          left: cx - w/2,
          top:  cy - h/2,
          width: w,
          height: h,
          right: cx + w/2,
          bottom: cy + h/2
        },
        center: { cx, cy },
        cuts
      };
      return lastSafe;
    }

    lastSafe = {
      playRect: pr,
      safeRect: { left, top, width:w, height:h, right, bottom },
      center: { cx: pr.left + pr.width/2, cy: pr.top + pr.height/2 },
      cuts
    };
    return lastSafe;
  }

  function getSafeRect(){
    return compute().safeRect;
  }

  function pickXY(rng){
    const st = compute();
    const sr = st.safeRect;
    const pr = st.playRect;

    // weighted center-ish
    const rx = (rng() + rng())/2;
    const ry = (rng() + rng())/2;

    const x = sr.left + rx * sr.width;
    const y = sr.top  + ry * sr.height;

    const xPct = ((x - pr.left)/Math.max(1, pr.width))*100;
    const yPct = ((y - pr.top )/Math.max(1, pr.height))*100;

    return { x, y, xPct, yPct, safe: sr, play: pr, meta: st };
  }

  function debugEnabled(){
    try{ return String(localStorage.getItem('HHA_DEBUG_SAFE')||'') === '1'; }catch(_){ return false; }
  }

  function renderDebug(){
    const on = debugEnabled();
    const layer = ensureDebugLayer();
    layer.style.display = on ? 'block' : 'none';
    if (!on) return;

    const st = compute();
    setRectBox('hha-safe-pr', st.playRect);
    setRectBox('hha-safe-sr', st.safeRect);
    setDot('hha-safe-dot', st.center.cx, st.center.cy);

    const c = st.cuts || {};
    setLabel(
      `HUD-SAFE DEBUG (localStorage HHA_DEBUG_SAFE=1)\n` +
      `safeRect: ${st.safeRect.width.toFixed(0)}x${st.safeRect.height.toFixed(0)}\n` +
      `cuts: top=${(c.topCut||0).toFixed(0)} bottom=${(c.bottomCut||0).toFixed(0)} left=${(c.leftCut||0).toFixed(0)} right=${(c.rightCut||0).toFixed(0)}`
    );
  }

  // auto update debug on events
  const reflow = ()=>setTimeout(renderDebug, 80);
  window.addEventListener('resize', reflow, { passive:true });
  window.addEventListener('orientationchange', reflow, { passive:true });
  window.addEventListener('fullscreenchange', reflow, { passive:true });

  // initial paint (if enabled)
  setTimeout(renderDebug, 60);

  return {
    compute,
    getSafeRect,
    pickXY,
    renderDebug
  };
}