// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (DOM-based lightweight FX)
// ✅ window.Particles.popText(x,y,text,cls?)
// ✅ window.Particles.pop(x,y,text) (alias)
// ✅ window.Particles.burst(x,y,opts)
// ✅ window.Particles.beam(x0,y0,x1,y1,opts) -> returns ms
// ✅ Auto creates fixed overlay layer (pointer-events:none)
// ✅ Safe on mobile / low-end devices (caps + cleanup)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_PARTICLES_LOADED__) return;
  WIN.__HHA_PARTICLES_LOADED__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function safeMount(){
    return DOC.body || DOC.documentElement;
  }

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

      /* ---- Beam ---- */
      .hha-beam{
        position:absolute;
        left:0; top:0;
        height:4px;
        border-radius:999px;
        transform-origin: 0 50%;
        will-change: transform, opacity;
        opacity:.9;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,.35));
        background: rgba(229,231,235,.9);
        box-shadow: 0 0 18px rgba(229,231,235,.35);
      }
      .hha-beam.good{
        background: rgba(34,197,94,.95);
        box-shadow: 0 0 18px rgba(34,197,94,.35);
      }
      .hha-beam.warn{
        background: rgba(245,158,11,.95);
        box-shadow: 0 0 18px rgba(245,158,11,.35);
      }
      .hha-beam.bad{
        background: rgba(239,68,68,.95);
        box-shadow: 0 0 18px rgba(239,68,68,.35);
      }
      .hha-beam.cyan{
        background: rgba(34,211,238,.95);
        box-shadow: 0 0 18px rgba(34,211,238,.35);
      }
      @keyframes hhaBeam {
        0%   { opacity: .92; }
        100% { opacity: 0; }
      }
    `;
    try{ DOC.head.appendChild(st); }catch{}
    try{ safeMount().appendChild(layer); }catch{}
    return layer;
  }

  // ---------- Limits ----------
  const LIMIT = {
    maxNodes: 140,
    maxSparks: 24,
    popDurationMs: 520,
    sparkDurationMs: 420,
    beamDurationMs: 120
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
    // force reflow (mobile reliable)
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
      s.className = 'hha-spark' + (cls ? ' ' + cls : '');

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

  function beam(x0, y0, x1, y1, opts){
    const layer = ensureLayer();
    cleanupIfNeeded(layer);

    const ms = clamp((opts && opts.ms) || LIMIT.beamDurationMs, 50, 260);
    const cls = (opts && opts.className) ? String(opts.className) : '';
    const thickness = clamp((opts && opts.thickness) || 4, 2, 14);

    const ax = clamp(x0, 0, WIN.innerWidth||999999);
    const ay = clamp(y0, 0, WIN.innerHeight||999999);
    const bx = clamp(x1, 0, WIN.innerWidth||999999);
    const by = clamp(y1, 0, WIN.innerHeight||999999);

    const dx = (bx - ax);
    const dy = (by - ay);
    const len = Math.max(8, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;

    const el = DOC.createElement('div');
    el.className = 'hha-beam' + (cls ? ' ' + cls : '');
    el.style.height = thickness.toFixed(0) + 'px';

    el.style.left = ax + 'px';
    el.style.top  = ay + 'px';
    el.style.width = len.toFixed(2) + 'px';
    el.style.transform = `translateY(-50%) rotate(${ang.toFixed(2)}deg)`;
    el.style.animation = `hhaBeam ${ms}ms ease-out forwards`;

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms + 40);
    return ms;
  }

  function pop(x,y,text){
    return popText(x,y,text,'');
  }

  const API = { popText, pop, burst, beam };
  WIN.Particles = API;
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.Particles = API;

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ()=>{ try{ ensureLayer(); }catch(_){ } }, { once:true });
  } else {
    try{ ensureLayer(); }catch(_){}
  }
})();