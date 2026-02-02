// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (DOM-based lightweight FX)
// ✅ window.Particles.popText(x,y,text,cls?)
// ✅ window.Particles.pop(x,y,text) (alias)
// ✅ window.Particles.burst(x,y,opts)
// ✅ window.Particles.ring(x,y,opts)  (shockwave)
// ✅ Auto creates fixed overlay layer (pointer-events:none)
// ✅ Safe on mobile / low-end devices (caps + cleanup)
// Notes: coordinates x,y are viewport pixels.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_PARTICLES_LOADED__) return;
  WIN.__HHA_PARTICLES_LOADED__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // ---------- Layer ----------
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

    // minimal styles
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
      .hha-popText.good{
        border-color: rgba(34,197,94,.24);
        background: rgba(34,197,94,.10);
      }
      .hha-popText.cyan{
        border-color: rgba(34,211,238,.26);
        background: rgba(34,211,238,.10);
      }
      .hha-popText.warn{
        border-color: rgba(245,158,11,.26);
        background: rgba(245,158,11,.12);
      }
      .hha-popText.bad{
        border-color: rgba(239,68,68,.26);
        background: rgba(239,68,68,.10);
      }

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

      .hha-ring{
        position:absolute;
        left:0; top:0;
        width: var(--ringSize, 110px);
        height: var(--ringSize, 110px);
        border-radius: 999px;
        transform: translate(-50%,-50%) scale(.68);
        opacity: .0;
        border: 3px solid rgba(239,68,68,.55);
        box-shadow: 0 0 0 2px rgba(239,68,68,.12);
        will-change: transform, opacity;
        pointer-events:none;
        animation: hhaRing var(--ringMs, 420ms) ease-out forwards;
      }
      .hha-ring.cyan{ border-color: rgba(34,211,238,.55); box-shadow: 0 0 0 2px rgba(34,211,238,.12); }
      .hha-ring.good{ border-color: rgba(34,197,94,.55); box-shadow: 0 0 0 2px rgba(34,197,94,.12); }
      .hha-ring.warn{ border-color: rgba(245,158,11,.55); box-shadow: 0 0 0 2px rgba(245,158,11,.12); }

      @keyframes hhaRing{
        0%   { opacity: .0; transform: translate(-50%,-50%) scale(.62); }
        20%  { opacity: .9; transform: translate(-50%,-50%) scale(.78); }
        100% { opacity: 0;  transform: translate(-50%,-50%) scale(1.22); }
      }
    `;
    DOC.head.appendChild(st);
    DOC.body.appendChild(layer);
    return layer;
  }

  // ---------- Limits ----------
  const LIMIT = {
    maxNodes: 140,
    maxSparks: 26,
    popDurationMs: 520,
    sparkDurationMs: 420
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

  // ---------- Public API ----------
  function popText(x, y, text, cls){
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
    const layer = ensureLayer();
    cleanupIfNeeded(layer);

    const count = clamp((opts && opts.count) || 12, 4, LIMIT.maxSparks)|0;
    const spread = clamp((opts && opts.spread) || 42, 18, 140);
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
      if (Math.random() < 0.35 && !(opts && opts.color)) s.style.background = 'rgba(34,211,238,.92)';
      if (Math.random() < 0.18 && !(opts && opts.color)) s.style.background = 'rgba(34,197,94,.92)';

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

  function ring(x, y, opts){
    const layer = ensureLayer();
    cleanupIfNeeded(layer);

    const vx = clamp(x, 0, WIN.innerWidth||999999);
    const vy = clamp(y, 0, WIN.innerHeight||999999);

    const el = DOC.createElement('div');
    el.className = 'hha-ring';
    const size = clamp((opts && opts.size) || 110, 60, 240);
    const ms   = clamp((opts && opts.ms)   || 420, 200, 1000);
    const cls  = (opts && opts.className) ? String(opts.className) : '';
    if(cls) el.className += ' ' + cls;

    el.style.left = vx + 'px';
    el.style.top  = vy + 'px';
    el.style.setProperty('--ringSize', size + 'px');
    el.style.setProperty('--ringMs', ms + 'ms');

    layer.appendChild(el);
    el.offsetHeight;
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms + 80);
    return true;
  }

  function pop(x,y,text){
    return popText(x,y,text,'');
  }

  const API = { popText, pop, burst, ring };

  WIN.Particles = API;
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.Particles = API;

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ()=>{ try{ ensureLayer(); }catch(_){ } }, { once:true });
  } else {
    try{ ensureLayer(); }catch(_){}
  }

})();