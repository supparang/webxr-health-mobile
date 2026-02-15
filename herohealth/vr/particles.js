// === /herohealth/vr/particles.js ===
// HeroHealth FX Core — PRODUCTION (LOCKED + SAFE)
// ✅ Shared FX layer for ALL games (GoodJunk/Groups/Hydration/Plate/Exercise)
// ✅ Never blocks input (pointer-events:none)
// ✅ Idempotent (safe to include multiple times)
// ✅ Exposes: Particles.popText / scorePop / burstAt / ringAt / shake / vignette
// ✅ Uses minimal CSS animations; no external deps

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc) return;

  // If already loaded, do NOT re-register styles again
  if(root.__HHA_PARTICLES_CORE__){
    root.Particles = root.Particles || {};
    return;
  }
  root.__HHA_PARTICLES_CORE__ = true;

  // ----------------------------
  // Layer
  // ----------------------------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    // IMPORTANT: match CSS hard-lock (but also safe if CSS missing)
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:140',
      'overflow:hidden',
      'contain:layout paint style',
      'transform:translateZ(0)'
    ].join(';');
    (doc.body || doc.documentElement).appendChild(layer);
    return layer;
  }

  function clamp(n,min,max){ n = Number(n)||0; return Math.max(min, Math.min(max,n)); }
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  // Convert client coords => safe within viewport
  function normXY(x,y){
    const W = doc.documentElement.clientWidth  || 1;
    const H = doc.documentElement.clientHeight || 1;
    const nx = clamp(x, 0, W);
    const ny = clamp(y, 0, H);
    return { x:nx, y:ny, W, H };
  }

  // ----------------------------
  // Styles (once)
  // ----------------------------
  const st = doc.createElement('style');
  st.textContent = `
  /* ===== HHA FX Core ===== */
  .hha-fx-layer{ position:fixed; inset:0; pointer-events:none; z-index:140; overflow:hidden; contain:layout paint style; transform:translateZ(0); }
  .hha-fx{
    position:absolute;
    left:0; top:0;
    transform: translate(-50%,-50%);
    will-change: transform, opacity, filter;
    pointer-events:none;
  }

  .hha-pop{
    font: 1000 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
    color:#fff;
    text-shadow: 0 10px 26px rgba(0,0,0,.55);
    opacity:.98;
    animation: hhaPop 560ms ease-out forwards;
  }
  @keyframes hhaPop{
    0%{ transform:translate(-50%,-50%) scale(.88); opacity:.92; }
    55%{ transform:translate(-50%,-72%) scale(1.14); opacity:1; }
    100%{ transform:translate(-50%,-96%) scale(1.04); opacity:0; }
  }

  .hha-score{
    font: 1200 20px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
    letter-spacing:.2px;
    color:#fff;
    text-shadow: 0 12px 28px rgba(0,0,0,.60);
    opacity:.98;
    animation: hhaScore 620ms cubic-bezier(.2,.9,.2,1) forwards;
  }
  @keyframes hhaScore{
    0%{ transform:translate(-50%,-50%) scale(.92); opacity:.0; }
    15%{ opacity:1; }
    60%{ transform:translate(-50%,-82%) scale(1.18); opacity:1; }
    100%{ transform:translate(-50%,-112%) scale(1.02); opacity:0; }
  }

  .hha-burst{
    width: 16px; height: 16px;
    border-radius: 999px;
    opacity:.98;
    animation: hhaBurst 520ms ease-out forwards;
  }
  @keyframes hhaBurst{
    0%{ transform:translate(-50%,-50%) scale(.75); opacity:.0; filter: blur(0px); }
    12%{ opacity:1; }
    70%{ transform:translate(-50%,-50%) scale(3.9); opacity:.85; filter: blur(.2px); }
    100%{ transform:translate(-50%,-50%) scale(5.0); opacity:0; filter: blur(.7px); }
  }

  .hha-ring{
    width: 22px; height: 22px;
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,.78);
    opacity:.98;
    animation: hhaRing 520ms ease-out forwards;
  }
  @keyframes hhaRing{
    0%{ transform:translate(-50%,-50%) scale(.55); opacity:.0; }
    15%{ opacity:1; }
    100%{ transform:translate(-50%,-50%) scale(6.2); opacity:0; }
  }

  .hha-vignette{
    position:fixed;
    inset:-40px;
    pointer-events:none;
    z-index:139;
    opacity:0;
    background: radial-gradient(circle at 50% 45%,
      rgba(0,0,0,0) 45%,
      rgba(0,0,0,.24) 75%,
      rgba(0,0,0,.55) 100%);
    transition: opacity 120ms ease;
  }
  .hha-vignette.on{ opacity:1; }

  .hha-shake{
    animation: hhaShake 140ms ease-in-out;
  }
  @keyframes hhaShake{
    0%{ transform:translate3d(0,0,0); }
    25%{ transform:translate3d(1.2px,-1px,0); }
    55%{ transform:translate3d(-1px,1.2px,0); }
    85%{ transform:translate3d(1px,.7px,0); }
    100%{ transform:translate3d(0,0,0); }
  }
  `;
  (doc.head || doc.documentElement).appendChild(st);

  // ----------------------------
  // Vignette (single instance)
  // ----------------------------
  let vignetteEl = null;
  function ensureVignette(){
    if(vignetteEl && vignetteEl.isConnected) return vignetteEl;
    vignetteEl = doc.querySelector('.hha-vignette');
    if(vignetteEl) return vignetteEl;
    vignetteEl = doc.createElement('div');
    vignetteEl.className = 'hha-vignette';
    (doc.body || doc.documentElement).appendChild(vignetteEl);
    return vignetteEl;
  }

  // ----------------------------
  // Internal helpers to add FX nodes
  // ----------------------------
  function addFxNode(className, x, y, cssText){
    const layer = ensureLayer();
    const { x:nx, y:ny } = normXY(x,y);
    const el = doc.createElement('div');
    el.className = `hha-fx ${className}`;
    el.style.left = nx + 'px';
    el.style.top  = ny + 'px';
    if(cssText) el.style.cssText += ';' + cssText;
    layer.appendChild(el);
    return el;
  }

  function autoRemove(el, ms){
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms);
  }

  // ----------------------------
  // Public FX API
  // ----------------------------
  function popText(x,y,text){
    const el = addFxNode('hha-pop', x,y);
    el.textContent = String(text ?? '');
    autoRemove(el, 700);
    return el;
  }

  function scorePop(x,y,text){
    const el = addFxNode('hha-score', x,y);
    el.textContent = String(text ?? '');
    autoRemove(el, 760);
    return el;
  }

  function burstAt(x,y, kind){
    // kinds: good/bad/star/shield/diamond/block
    const k = String(kind||'good');
    let bg = 'rgba(34,197,94,.38)';           // good
    let ring = 'rgba(34,197,94,.65)';

    if(k==='bad'){ bg='rgba(239,68,68,.35)'; ring='rgba(239,68,68,.62)'; }
    if(k==='star'){ bg='rgba(245,158,11,.30)'; ring='rgba(245,158,11,.60)'; }
    if(k==='shield'){ bg='rgba(96,165,250,.30)'; ring='rgba(96,165,250,.62)'; }
    if(k==='diamond'){ bg='rgba(167,139,250,.30)'; ring='rgba(167,139,250,.62)'; }
    if(k==='block'){ bg='rgba(148,163,184,.22)'; ring='rgba(226,232,240,.62)'; }

    const a = addFxNode('hha-burst', x,y, `background:${bg};`);
    const b = addFxNode('hha-ring', x,y, `border-color:${ring};`);
    autoRemove(a, 680);
    autoRemove(b, 680);
    return { burst:a, ring:b };
  }

  function ringAt(x,y, color){
    const c = color ? String(color) : 'rgba(255,255,255,.75)';
    const el = addFxNode('hha-ring', x,y, `border-color:${c};`);
    autoRemove(el, 680);
    return el;
  }

  function shake(ms){
    ms = clamp(ms ?? 140, 80, 420);
    const b = doc.body;
    try{
      b.classList.add('hha-shake');
      setTimeout(()=> b.classList.remove('hha-shake'), ms);
    }catch(_){}
  }

  function vignette(on, ttlMs){
    const v = ensureVignette();
    try{
      if(on){
        v.classList.add('on');
        if(ttlMs != null){
          const t = clamp(ttlMs, 80, 1200);
          setTimeout(()=>{ try{ v.classList.remove('on'); }catch(_){ } }, t);
        }
      }else{
        v.classList.remove('on');
      }
    }catch(_){}
  }

  // quick presets (optional)
  function hitGood(x,y){
    burstAt(x,y,'good');
  }
  function hitBad(x,y){
    burstAt(x,y,'bad');
    vignette(true, 180);
    shake(140);
  }

  // ----------------------------
  // Export
  // ----------------------------
  root.Particles = root.Particles || {};
  root.Particles.popText  = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt  = burstAt;
  root.Particles.ringAt   = ringAt;
  root.Particles.shake    = shake;
  root.Particles.vignette = vignette;

  // handy presets
  root.Particles.hitGood = hitGood;
  root.Particles.hitBad  = hitBad;

})(window);