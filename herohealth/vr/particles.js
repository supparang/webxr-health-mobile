// === /herohealth/vr/particles.js ===
// Simple FX Layer — score pop + burst + celebrate (PRODUCTION)
// Provides window.Particles + window.GAME_MODULES.Particles
// Safe: creates a top z-index layer; no dependencies.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const Z = 9999; // make sure FX is always on top

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:${Z};
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function el(tag, cssText){
    const n = doc.createElement(tag);
    if (cssText) n.style.cssText = cssText;
    return n;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const n = el('div');
    n.className = 'hha-pop ' + (cls||'');
    n.textContent = String(text ?? '');
    n.style.cssText = `
      position:absolute;
      left:${Number(x)||0}px; top:${Number(y)||0}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui, -apple-system, Segoe UI, sans-serif;
      color:#fff;
      text-shadow: 0 2px 0 rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.35);
      opacity:0;
      will-change: transform, opacity;
      transition: transform 520ms cubic-bezier(.2,.9,.2,1), opacity 520ms ease;
      user-select:none;
    `;
    layer.appendChild(n);

    // animate in next tick
    requestAnimationFrame(()=>{
      n.style.opacity = '1';
      n.style.transform = 'translate(-50%,-70%) scale(1.08)';
    });

    setTimeout(()=>{
      n.style.opacity = '0';
      n.style.transform = 'translate(-50%,-120%) scale(0.98)';
    }, 320);

    setTimeout(()=>{ try{ n.remove(); }catch(_){} }, 900);
  }

  function burst(x,y,opts){
    const layer = ensureLayer();
    const n = el('div');
    const r = Math.max(10, Math.min(90, Number(opts?.r)||42));
    n.className = 'hha-burst';
    n.style.cssText = `
      position:absolute;
      left:${Number(x)||0}px; top:${Number(y)||0}px;
      width:${r*2}px; height:${r*2}px;
      border-radius:999px;
      transform: translate(-50%,-50%) scale(0.3);
      opacity:0.0;
      border:2px solid rgba(255,255,255,.85);
      box-shadow: 0 0 0 0 rgba(255,255,255,.25);
      will-change: transform, opacity, box-shadow;
      transition: transform 420ms cubic-bezier(.2,.9,.2,1), opacity 420ms ease, box-shadow 420ms ease;
      pointer-events:none;
    `;
    layer.appendChild(n);

    requestAnimationFrame(()=>{
      n.style.opacity = '1';
      n.style.transform = 'translate(-50%,-50%) scale(1.0)';
      n.style.boxShadow = `0 0 0 ${Math.round(r*0.9)}px rgba(255,255,255,.08)`;
    });

    setTimeout(()=>{
      n.style.opacity = '0';
      n.style.transform = 'translate(-50%,-50%) scale(1.18)';
    }, 240);

    setTimeout(()=>{ try{ n.remove(); }catch(_){} }, 820);
  }

  function shockwave(x,y,opts){
    // a slightly stronger burst
    burst(x,y,{ r: Math.max(48, Number(opts?.r)||68) });
  }

  function celebrate(){
    // simple confetti-ish: multiple bursts around center
    const cx = innerWidth/2, cy = innerHeight*0.38;
    for(let i=0;i<10;i++){
      const dx = (Math.random()*2-1) * 180;
      const dy = (Math.random()*2-1) * 110;
      setTimeout(()=>burst(cx+dx, cy+dy, { r: 26 + Math.random()*36 }), i*40);
    }
  }

  root.Particles = { ensureLayer, popText, burst, shockwave, celebrate };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);