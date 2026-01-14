// === /herohealth/vr-goodjunk/particles.js ===
// Simple FX Layer — score pop + burst + shockwave
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
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:190;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute;
      left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui;
      color:#fff;
      opacity:.98;
      text-shadow: 0 10px 28px rgba(0,0,0,.55);
      will-change: transform, opacity;
      pointer-events:none;
    `;
    if (cls === 'big') el.style.fontSize = '28px';
    if (cls === 'score') el.style.fontSize = '16px';
    layer.appendChild(el);

    const t0 = performance.now();
    const dur = (cls === 'big') ? 720 : 520;

    function tick(t){
      const p = Math.min(1, (t - t0)/dur);
      const dy = -22 * p;
      const sc = 1 + 0.10*Math.sin(p*Math.PI);
      el.style.transform = `translate(-50%,-50%) translateY(${dy}px) scale(${sc})`;
      el.style.opacity = String(1 - 0.95*p);
      if(p<1) requestAnimationFrame(tick);
      else el.remove();
    }
    requestAnimationFrame(tick);
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const n = (kind==='bad') ? 10 : 8;
    for(let i=0;i<n;i++){
      const p = doc.createElement('div');
      p.textContent = (kind==='bad') ? '💥' : (kind==='star' ? '✨' : '✦');
      const ang = (Math.PI*2) * (i/n) + (Math.random()*0.4);
      const r = (kind==='bad') ? 70 : 58;
      const dx = Math.cos(ang)*r;
      const dy = Math.sin(ang)*r;
      p.style.cssText = `
        position:absolute;
        left:${x}px; top:${y}px;
        transform: translate(-50%,-50%);
        font-size:${(kind==='bad')?20:18}px;
        opacity:.95;
        filter: drop-shadow(0 10px 25px rgba(0,0,0,.45));
      `;
      layer.appendChild(p);

      const t0 = performance.now();
      const dur = 520;

      function tick(t){
        const q = Math.min(1, (t - t0)/dur);
        const ease = 1 - Math.pow(1-q, 3);
        p.style.transform = `translate(-50%,-50%) translate(${dx*ease}px,${dy*ease}px) scale(${1-0.25*q})`;
        p.style.opacity = String(1 - q);
        if(q<1) requestAnimationFrame(tick);
        else p.remove();
      }
      requestAnimationFrame(tick);
    }
  }

  const API = { popText, burstAt };
  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;
})(window);