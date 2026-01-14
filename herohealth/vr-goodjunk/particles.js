// === /herohealth/vr-goodjunk/particles.js ===
// Simple FX Layer — popText + burstAt
// Exposes: window.Particles

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc) return;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:190;
      overflow:hidden; contain: layout style paint;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x,y,text,cls=''){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 16px/1 system-ui;
      color: rgba(255,255,255,.95);
      text-shadow: 0 10px 24px rgba(0,0,0,.55);
      opacity: 0;
      will-change: transform, opacity;
    `;
    if(cls === 'big'){
      el.style.fontSize = '20px';
      el.style.fontWeight = '1200';
    }
    layer.appendChild(el);

    const t0 = performance.now();
    const dur = 520;
    function raf(t){
      const p = Math.min(1, (t - t0)/dur);
      const ease = 1 - Math.pow(1-p, 3);
      el.style.opacity = String(1 - p*0.9);
      el.style.transform = `translate(-50%,-50%) translateY(${-28*ease}px) scale(${0.96 + 0.18*ease})`;
      if(p < 1) requestAnimationFrame(raf);
      else el.remove();
    }
    requestAnimationFrame(raf);
  }

  function burstAt(x,y,kind='star'){
    const layer = ensureLayer();
    const n = (kind==='bad') ? 10 : 12;

    for(let i=0;i<n;i++){
      const p = doc.createElement('div');
      p.textContent = (kind==='bad') ? '✖' : '✦';
      p.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        transform: translate(-50%,-50%);
        font: 900 14px/1 system-ui;
        color: rgba(255,255,255,.9);
        opacity: 0;
        will-change: transform, opacity;
      `;
      layer.appendChild(p);

      const ang = Math.random()*Math.PI*2;
      const sp  = 28 + Math.random()*48;
      const dx  = Math.cos(ang)*sp;
      const dy  = Math.sin(ang)*sp;
      const t0  = performance.now();
      const dur = 420 + Math.random()*220;

      function raf(t){
        const pr = Math.min(1, (t - t0)/dur);
        const ease = 1 - Math.pow(1-pr, 3);
        p.style.opacity = String(1 - pr);
        p.style.transform = `translate(-50%,-50%) translate(${dx*ease}px, ${dy*ease}px) scale(${0.9 + 0.6*(1-pr)})`;
        if(pr < 1) requestAnimationFrame(raf);
        else p.remove();
      }
      requestAnimationFrame(raf);
    }
  }

  root.Particles = { popText, burstAt };
})(window);