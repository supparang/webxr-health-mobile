// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (shared FX layer for ALL games)
// ✅ One global layer: .hha-fx-layer (z=90) + optional below-HUD layer
// ✅ API:
//    Particles.scorePop(x,y,text, cls?)
//    Particles.burstAt(x,y, kind?='good'|'bad'|'star'|'shield'|'diamond'|'block')
//    Particles.shockwave(x,y, kind?)
//    Particles.celebrate(kind?)
// ✅ Lightweight object pooling (no GC spikes)
// ✅ Safe for mobile + low power; honors prefers-reduced-motion
// ✅ Works even if called before DOMContentLoaded (lazy init)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // --------------------------------------------
  // Config
  // --------------------------------------------
  const CFG = {
    zIndex: 90,
    maxNodes: 140,         // soft cap of active nodes
    poolSize: 80,          // initial pool nodes
    ttlGuardMs: 2500,      // hard cleanup if animation doesn't end
    textTtlMs: 900,
    burstTtlMs: 900,
    waveTtlMs: 1100,
    celebrateTtlMs: 1600,
    reduceMotion: false,
  };

  try{
    CFG.reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }catch(_){}

  // --------------------------------------------
  // Utils
  // --------------------------------------------
  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();
  const rnd = (a,b)=> a + Math.random()*(b-a);

  function ensureStyle(){
    if(doc.getElementById('hhaParticlesStyle')) return;
    const st = doc.createElement('style');
    st.id = 'hhaParticlesStyle';
    st.textContent = `
      .hha-fx-layer{
        position:fixed; inset:0;
        pointer-events:none;
        overflow:hidden;
        z-index:${CFG.zIndex};
        contain: layout style paint;
      }
      .hha-fx{
        position:absolute;
        left:0; top:0;
        transform: translate(-50%,-50%);
        will-change: transform, opacity, filter;
        pointer-events:none;
        user-select:none;
      }

      /* ---- score pop ---- */
      @keyframes hhaPop{
        0%   { transform:translate(-50%,-50%) scale(.92); opacity:.92; }
        65%  { transform:translate(-50%,-80%) scale(1.18); opacity:1; }
        100% { transform:translate(-50%,-104%) scale(1.06); opacity:0; }
      }
      .hha-pop{
        font: 1000 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        color:#fff;
        text-shadow: 0 10px 24px rgba(0,0,0,.55);
        opacity:.98;
        animation: hhaPop 520ms ease-out forwards;
      }
      .hha-pop.good{ text-shadow: 0 10px 24px rgba(34,197,94,.22), 0 10px 24px rgba(0,0,0,.55); }
      .hha-pop.bad{  text-shadow: 0 10px 24px rgba(239,68,68,.22), 0 10px 24px rgba(0,0,0,.55); }
      .hha-pop.star{ text-shadow: 0 10px 24px rgba(245,158,11,.22), 0 10px 24px rgba(0,0,0,.55); }
      .hha-pop.shield{ text-shadow: 0 10px 24px rgba(34,211,238,.22), 0 10px 24px rgba(0,0,0,.55); }
      .hha-pop.diamond{ text-shadow: 0 10px 24px rgba(167,139,250,.24), 0 10px 24px rgba(0,0,0,.55); }

      /* ---- burst confetti (emoji sparks) ---- */
      @keyframes hhaBurst{
        0%   { transform:translate(var(--x0), var(--y0)) scale(.9) rotate(0deg); opacity:0; }
        15%  { opacity:1; }
        100% { transform:translate(var(--x1), var(--y1)) scale(1.05) rotate(var(--rot)); opacity:0; }
      }
      .hha-burst{
        font: 1000 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        filter: drop-shadow(0 10px 24px rgba(0,0,0,.45));
        animation: hhaBurst 760ms cubic-bezier(.2,.9,.1,1) forwards;
        opacity:0;
      }

      /* ---- shockwave ring ---- */
      @keyframes hhaWave{
        0%   { transform:translate(-50%,-50%) scale(.25); opacity:.0; }
        10%  { opacity:.95; }
        100% { transform:translate(-50%,-50%) scale(1.45); opacity:0; }
      }
      .hha-wave{
        width: 18px; height: 18px;
        border-radius: 999px;
        border: 3px solid rgba(148,163,184,.22);
        box-shadow: 0 0 0 10px rgba(148,163,184,.06);
        animation: hhaWave 820ms ease-out forwards;
        opacity:0;
      }
      .hha-wave.good{ border-color: rgba(34,197,94,.26); box-shadow: 0 0 0 12px rgba(34,197,94,.06); }
      .hha-wave.bad{ border-color: rgba(239,68,68,.28); box-shadow: 0 0 0 12px rgba(239,68,68,.06); }
      .hha-wave.star{ border-color: rgba(245,158,11,.28); box-shadow: 0 0 0 12px rgba(245,158,11,.06); }
      .hha-wave.shield{ border-color: rgba(34,211,238,.28); box-shadow: 0 0 0 12px rgba(34,211,238,.06); }
      .hha-wave.diamond{ border-color: rgba(167,139,250,.30); box-shadow: 0 0 0 12px rgba(167,139,250,.06); }
      .hha-wave.block{ border-color: rgba(34,211,238,.30); box-shadow: 0 0 0 14px rgba(34,211,238,.06); }

      /* ---- celebrate rain ---- */
      @keyframes hhaRain{
        0%   { transform:translate(var(--x), -10vh) rotate(0deg) scale(.95); opacity:0; }
        10%  { opacity:1; }
        100% { transform:translate(var(--x), 110vh) rotate(var(--rot)) scale(1.05); opacity:0; }
      }
      .hha-rain{
        font: 1000 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        opacity:0;
        filter: drop-shadow(0 10px 24px rgba(0,0,0,.38));
        animation: hhaRain 1200ms linear forwards;
      }

      /* reduced motion */
      @media (prefers-reduced-motion: reduce){
        .hha-pop,.hha-burst,.hha-wave,.hha-rain{ animation:none !important; opacity:0 !important; }
      }
    `;
    doc.head.appendChild(st);
  }

  // --------------------------------------------
  // Layer + Pool
  // --------------------------------------------
  let layer = null;
  let activeCount = 0;

  const pool = [];
  function allocNode(){
    let el = pool.pop();
    if(!el){
      el = doc.createElement('div');
      el.className = 'hha-fx';
    }
    return el;
  }
  function freeNode(el){
    if(!el) return;
    try{
      el.className = 'hha-fx';
      el.removeAttribute('style');
      el.textContent = '';
      el.innerHTML = '';
      el.onanimationend = null;
      el.onanimationcancel = null;
      if(el.parentNode) el.parentNode.removeChild(el);
    }catch(_){}
    pool.push(el);
  }

  function ensureLayer(){
    if(layer && layer.isConnected) return layer;
    ensureStyle();
    layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.setAttribute('aria-hidden','true');
    doc.body.appendChild(layer);
    // warm pool
    for(let i=0;i<CFG.poolSize;i++){
      pool.push(doc.createElement('div'));
      pool[pool.length-1].className = 'hha-fx';
    }
    return layer;
  }

  function mount(el){
    const L = ensureLayer();
    if(!L) return false;

    // soft cap
    if(activeCount > CFG.maxNodes){
      // drop oldest by clearing layer quickly (safe)
      try{ L.innerHTML = ''; }catch(_){}
      activeCount = 0;
    }

    try{
      L.appendChild(el);
      activeCount++;
      return true;
    }catch(_){
      return false;
    }
  }

  function autoFree(el, ttlMs){
    const born = now();
    const done = ()=>{
      if(!el) return;
      activeCount = Math.max(0, activeCount-1);
      freeNode(el);
      el = null;
    };
    el.onanimationend = done;
    el.onanimationcancel = done;

    // hard guard
    setTimeout(()=>{
      if(!el) return;
      if(now() - born >= (ttlMs||CFG.ttlGuardMs)){
        done();
      }
    }, (ttlMs||CFG.ttlGuardMs) + 60);
  }

  // --------------------------------------------
  // FX API
  // --------------------------------------------
  function scorePop(x,y,text, cls){
    if(CFG.reduceMotion) return;
    if(x==null || y==null) return;
    const el = allocNode();
    el.className = 'hha-fx hha-pop ' + (cls||'');
    el.textContent = String(text ?? '');
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
    if(!mount(el)) { freeNode(el); return; }
    autoFree(el, CFG.textTtlMs);
  }

  function burstAt(x,y, kind){
    if(CFG.reduceMotion) return;
    if(x==null || y==null) return;
    const K = String(kind||'good');

    // spark set
    const SP = (K==='good') ? ['✨','🍀','💚'] :
               (K==='bad') ? ['💥','⚡','💢'] :
               (K==='star') ? ['⭐','✨','🌟'] :
               (K==='shield') ? ['🛡️','✨','💠'] :
               (K==='diamond') ? ['💎','✨','🟣'] :
               (K==='block') ? ['🛡️','💨','💠'] : ['✨','💥','⚡'];

    const n = clamp((K==='diamond')? 10 : (K==='bad'? 8 : 7), 5, 12);

    for(let i=0;i<n;i++){
      const el = allocNode();
      el.className = 'hha-fx hha-burst';
      el.textContent = SP[(Math.random()*SP.length)|0];

      const dx0 = rnd(-6,6);
      const dy0 = rnd(-6,6);
      const dx1 = rnd(-90,90);
      const dy1 = rnd(-130,-40);
      const rot = rnd(-220,220) + 'deg';

      el.style.left = Math.round(x) + 'px';
      el.style.top  = Math.round(y) + 'px';
      el.style.setProperty('--x0', dx0+'px');
      el.style.setProperty('--y0', dy0+'px');
      el.style.setProperty('--x1', dx1+'px');
      el.style.setProperty('--y1', dy1+'px');
      el.style.setProperty('--rot', rot);
      el.style.fontSize = Math.round(rnd(16,22)) + 'px';

      if(!mount(el)) { freeNode(el); continue; }
      autoFree(el, CFG.burstTtlMs);
    }

    // add wave for feedback
    shockwave(x,y, K==='bad' ? 'bad' : (K==='block' ? 'block' : K));
  }

  function shockwave(x,y, kind){
    if(CFG.reduceMotion) return;
    const K = String(kind||'good');
    const el = allocNode();
    el.className = 'hha-fx hha-wave ' + K;
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
    if(!mount(el)) { freeNode(el); return; }
    autoFree(el, CFG.waveTtlMs);
  }

  function celebrate(kind){
    if(CFG.reduceMotion) return;
    const K = String(kind||'end');
    const ICONS = (K==='end') ? ['🎉','✨','🌟','💚'] :
                  (K==='mini') ? ['✨','⭐','🌟','🎉'] :
                  (K==='boss') ? ['💥','⚡','🔥','💢'] :
                  ['🎉','✨','⭐'];

    const n = (K==='boss') ? 22 : 16;
    for(let i=0;i<n;i++){
      const el = allocNode();
      el.className = 'hha-fx hha-rain';
      el.textContent = ICONS[(Math.random()*ICONS.length)|0];

      const xPct = rnd(5,95);
      const rot = rnd(-240,240) + 'deg';
      el.style.left = xPct + 'vw';
      el.style.top  = '-10vh';
      el.style.setProperty('--x', xPct + 'vw');
      el.style.setProperty('--rot', rot);
      el.style.fontSize = Math.round(rnd(16,24)) + 'px';
      el.style.animationDuration = Math.round(rnd(900,1350)) + 'ms';
      el.style.animationDelay = Math.round(rnd(0,220)) + 'ms';

      if(!mount(el)) { freeNode(el); continue; }
      autoFree(el, CFG.celebrateTtlMs);
    }
  }

  // --------------------------------------------
  // Public export (shared)
  // --------------------------------------------
  root.Particles = root.Particles || {};
  root.Particles.scorePop = scorePop;
  root.Particles.popText  = scorePop;   // backward compat
  root.Particles.burstAt  = burstAt;
  root.Particles.shockwave= shockwave;
  root.Particles.celebrate= celebrate;

  // also expose via GAME_MODULES if used by some engines
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);