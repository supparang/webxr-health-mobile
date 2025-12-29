// === /herohealth/vr/particles.js ===
// Simple FX Layer — score pop + burst + celebrate
// Provides window.Particles + window.GAME_MODULES.Particles

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed','inset:0','pointer-events:none','z-index:90','overflow:hidden'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.className = 'hha-fx-pop ' + (cls || '');
    el.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      'transform:translate(-50%,-50%)',
      'font:900 18px/1 system-ui',
      'color:#fff',
      'text-shadow:0 2px 0 rgba(0,0,0,.35), 0 12px 40px rgba(0,0,0,.35)',
      'opacity:0',
      'will-change:transform,opacity'
    ].join(';');
    layer.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform 420ms ease, opacity 420ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-60%) scale(1.06)';
      setTimeout(()=>{
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-90%) scale(.96)';
      }, 180);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
    });
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const n = 10;
    for (let i=0;i<n;i++){
      const p = doc.createElement('div');
      const ang = (Math.PI * 2) * (i / n);
      const r = 18 + Math.random()*22;
      const dx = Math.cos(ang) * r;
      const dy = Math.sin(ang) * r;

      p.style.cssText = [
        'position:absolute',
        `left:${x}px`,
        `top:${y}px`,
        'width:8px',
        'height:8px',
        'border-radius:999px',
        'opacity:0.0',
        'transform:translate(-50%,-50%)',
        'will-change:transform,opacity'
      ].join(';');

      // color hint (no fixed palette; use simple mapping)
      let bg = 'rgba(226,232,240,.85)';
      if (kind === 'good') bg = 'rgba(34,197,94,.90)';
      if (kind === 'junk') bg = 'rgba(239,68,68,.90)';
      if (kind === 'shield') bg = 'rgba(168,85,247,.90)';
      if (kind === 'star') bg = 'rgba(34,211,238,.90)';
      if (kind === 'guard') bg = 'rgba(168,85,247,.70)';
      p.style.background = bg;

      layer.appendChild(p);

      requestAnimationFrame(()=>{
        p.style.transition = 'transform 420ms ease, opacity 420ms ease';
        p.style.opacity = '1';
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`;
        setTimeout(()=>{
          p.style.opacity = '0';
          p.style.transform = `translate(calc(-50% + ${dx*1.35}px), calc(-50% + ${dy*1.35}px)) scale(.8)`;
        }, 140);
        setTimeout(()=>{ try{ p.remove(); }catch(_){ } }, 520);
      });
    }
  }

  function celebrate(kind, title){
    // show centered banner pop
    const w = root.innerWidth || 360;
    const h = root.innerHeight || 640;
    popText(w*0.5, h*0.45, title || 'Nice!', kind || '');
  }

  const api = {
    scorePop: popText,
    burstAt,
    celebrate
  };

  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;
})(typeof window !== 'undefined' ? window : globalThis);