// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (DOM-based lightweight FX)
// ✅ window.Particles.popText(x,y,text,cls?)
// ✅ window.Particles.burst(x,y,opts)
// ✅ window.Particles.beam(x1,y1,x2,y2,opts)
// ✅ Auto creates fixed overlay layer (pointer-events:none)
// ✅ Low-power mode for VR/cVR + prefers-reduced-motion
// Notes: coordinates x,y are viewport pixels.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_PARTICLES_LOADED__) return;
  WIN.__HHA_PARTICLES_LOADED__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function prefersReducedMotion(){
    try{ return !!WIN.matchMedia && WIN.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch{ return false; }
  }
  function inferLowPower(){
    // “low power” if view=vr/cvr OR low deviceMemory OR reduced motion
    try{
      const v = new URL(location.href).searchParams.get('view');
      const view = (v||'').toLowerCase();
      if(view==='vr' || view==='cvr') return true;
    }catch{}
    try{
      const dm = WIN.navigator?.deviceMemory;
      if(typeof dm === 'number' && dm > 0 && dm <= 4) return true;
    }catch{}
    if(prefersReducedMotion()) return true;
    return false;
  }
  const LOW_POWER = inferLowPower();

  function ensureLayer(){
    let layer = DOC.getElementById('hha-particles');
    if (layer) return layer;

    layer = DOC.createElement('div');
    layer.id = 'hha-particles';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:9999',
      'overflow:hidden',
      'contain:layout style paint',
      'transform:translateZ(0)'
    ].join(';');

    const st = DOC.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-popText{
        position:absolute;
        left:0; top:0;
        transform: translate(-50%,-50%);
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
        font-weight: 900;
        font-size: 14px;
        line-height: 1;
        color: rgba(229,231,235,.95);
        text-shadow: 0 10px 24px rgba(0,0,0,.55);
        filter: drop-shadow(0 10px 26px rgba(0,0,0,.45));
        will-change: transform, opacity;
        opacity: 0;
        white-space: nowrap;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.55);
        backdrop-filter: blur(10px);
      }
      .hha-popText.good{ border-color: rgba(34,197,94,.24); background: rgba(34,197,94,.10); }
      .hha-popText.cyan{ border-color: rgba(34,211,238,.26); background: rgba(34,211,238,.10); }
      .hha-popText.warn{ border-color: rgba(245,158,11,.26); background: rgba(245,158,11,.12); }
      .hha-popText.bad { border-color: rgba(239,68,68,.26); background: rgba(239,68,68,.10); }

      @keyframes hhaPopUp {
        0%   { opacity: 0; transform: translate(-50%,-50%) scale(.86) translateY(10px); }
        15%  { opacity: 1; transform: translate(-50%,-50%) scale(1.02) translateY(0px); }
        60%  { opacity: 1; transform: translate(-50%,-50%) scale(1.00) translateY(-10px); }
        100% { opacity: 0; transform: translate(-50%,-50%) scale(.98) translateY(-18px); }
      }

      .hha-spark{
        position:absolute;
        left:0; top:0;
        width:6px; height:6px;
        border-radius:999px;
        opacity:.9;
        will-change: transform, opacity;
        transform: translate(-50%,-50%);
        filter: drop-shadow(0 8px 18px rgba(0,0,0,.35));
      }
      @keyframes hhaSpark {
        0%   { opacity:.95; transform: translate(-50%,-50%) translate(0px,0px) scale(1); }
        100% { opacity:0;   transform: translate(-50%,-50%) translate(var(--dx,0px), var(--dy,-36px)) scale(.6); }
      }

      /* BEAM */
      .hha-beam{
        position:absolute;
        left:0; top:0;
        height: 4px;
        transform-origin: 0 50%;
        border-radius: 999px;
        opacity: .95;
        background: rgba(229,231,235,.95);
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
        will-change: transform, opacity;
      }
      .hha-beam.good{ background: rgba(34,197,94,.95); }
      .hha-beam.warn{ background: rgba(245,158,11,.95); }
      .hha-beam.bad { background: rgba(239,68,68,.95); }
      .hha-beam.cyan{ background: rgba(34,211,238,.95); }

      @keyframes hhaBeam {
        0%   { opacity: 0; transform: translate(0,0) rotate(var(--a,0rad)) scaleX(.20); }
        25%  { opacity: .95; transform: translate(0,0) rotate(var(--a,0rad)) scaleX(1.00); }
        100% { opacity: 0; transform: translate(0,0) rotate(var(--a,0rad)) scaleX(.98); }
      }
    `;
    DOC.head.appendChild(st);
    DOC.body.appendChild(layer);
    return layer;
  }

  const LIMIT = {
    maxNodes: LOW_POWER ? 80 : 140,
    maxSparks: LOW_POWER ? 12 : 24,
    popDurationMs: LOW_POWER ? 420 : 520,
    sparkDurationMs: LOW_POWER ? 300 : 420,
    beamDurationMs: LOW_POWER ? 110 : 140
  };

  function cleanupIfNeeded(layer){
    const kids = layer.children;
    if (!kids) return;
    const n = kids.length|0;
    if (n <= LIMIT.maxNodes) return;

    const removeCount = n - LIMIT.maxNodes;
    for (let i=0; i<removeCount; i++){
      try{ kids[i].remove(); }catch(_){}
    }
  }

  function popText(x, y, text, cls){
    if(prefersReducedMotion()) return true;
    const layer = ensureLayer();
    cleanupIfNeeded(layer);

    const el = DOC.createElement('div');
    el.className = 'hha-popText' + (cls ? ' ' + String(cls) : '');
    el.textContent = String(text ?? '');

    const vx = clamp(x, 0, WIN.innerWidth||999999);
    const vy = clamp(y, 0, WIN.innerHeight||999999);
    el.style.left = vx + 'px';
    el.style.top  = vy + 'px';
    el.style.animation = `hhaPopUp ${LIMIT.popDurationMs}ms ease-out forwards`;

    layer.appendChild(el);
    el.offsetHeight;
    el.style.opacity = '1';

    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, LIMIT.popDurationMs + 60);
    return true;
  }

  function burst(x, y, opts){
    if(prefersReducedMotion()) return true;
    const layer = ensureLayer();
    cleanupIfNeeded(layer);

    const count = clamp((opts && opts.count) || 12, 4, LIMIT.maxSparks)|0;
    const spread = clamp((opts && opts.spread) || 42, 18, 110);
    const upBias = clamp((opts && opts.upBias) || 0.78, 0, 1);
    const cls = (opts && opts.className) ? String(opts.className) : '';

    const vx = clamp(x, 0, WIN.innerWidth||999999);
    const vy = clamp(y, 0, WIN.innerHeight||999999);

    for (let i=0;i<count;i++){
      const s = DOC.createElement('div');
      s.className = 'hha-spark ' + cls;

      const a = (i/count) * Math.PI * 2;
      const r = spread * (0.35 + Math.random()*0.85);
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r * (0.55 + upBias);

      s.style.background = (opts && opts.color) ? String(opts.color) : 'rgba(229,231,235,.92)';
      if (Math.random() < 0.35) s.style.background = 'rgba(34,211,238,.92)';
      if (Math.random() < 0.18) s.style.background = 'rgba(34,197,94,.92)';

      s.style.left = vx + 'px';
      s.style.top  = vy + 'px';
      s.style.setProperty('--dx', dx.toFixed(1) + 'px');
      s.style.setProperty('--dy', (dy*-1).toFixed(1) + 'px');

      s.style.animation = `hhaSpark ${LIMIT.sparkDurationMs}ms ease-out forwards`;

      layer.appendChild(s);
      setTimeout(()=>{ try{ s.remove(); }catch(_){ } }, LIMIT.sparkDurationMs + 60);
    }
    return true;
  }

  function beam(x1,y1,x2,y2, opts){
    if(prefersReducedMotion()) return true;
    const layer = ensureLayer();
    cleanupIfNeeded(layer);

    const vx1 = clamp(x1, 0, WIN.innerWidth||999999);
    const vy1 = clamp(y1, 0, WIN.innerHeight||999999);
    const vx2 = clamp(x2, 0, WIN.innerWidth||999999);
    const vy2 = clamp(y2, 0, WIN.innerHeight||999999);

    const dx = vx2 - vx1;
    const dy = vy2 - vy1;
    const len = Math.max(6, Math.hypot(dx,dy));
    const ang = Math.atan2(dy,dx);

    const el = DOC.createElement('div');
    el.className = 'hha-beam' + ((opts && opts.className) ? (' ' + String(opts.className)) : '');
    el.style.left = vx1 + 'px';
    el.style.top  = vy1 + 'px';
    el.style.width = len.toFixed(1) + 'px';
    el.style.setProperty('--a', ang.toFixed(6) + 'rad');

    const thick = clamp((opts && opts.thickness) || 4, 2, LOW_POWER ? 8 : 16);
    el.style.height = thick.toFixed(1) + 'px';

    const ms = clamp((opts && opts.ms) || LIMIT.beamDurationMs, 60, LOW_POWER ? 220 : 360);
    el.style.animation = `hhaBeam ${ms}ms ease-out forwards`;

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms + 60);
    return true;
  }

  function pop(x,y,text){ return popText(x,y,text,''); }

  const API = { popText, pop, burst, beam, lowPower: LOW_POWER };

  WIN.Particles = API;
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.Particles = API;

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ()=>{ try{ ensureLayer(); }catch(_){ } }, { once:true });
  } else {
    try{ ensureLayer(); }catch(_){}
  }
})();