// === /herohealth/vr-goodjunk/particles.js ===
// Minimal FX layer (compatible with WIN.Particles.popText / burstAt)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:190; overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      transform:translate(-50%,-50%);
      font: 1000 14px/1 system-ui;
      color:#fff; text-shadow:0 8px 24px rgba(0,0,0,.55);
      opacity:0; transition: transform 180ms ease, opacity 180ms ease;
      padding:6px 10px; border-radius:999px;
      background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18);
    `;
    layer.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-70%)';
    });
    setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translate(-50%,-90%)';
    }, 220);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 520);
  }

  function burstAt(x,y,type){
    const layer = ensureLayer();
    for(let i=0;i<10;i++){
      const p = doc.createElement('div');
      p.textContent = (type==='bad') ? '✖' : '✦';
      const dx = (Math.random()*2-1)*70;
      const dy = (Math.random()*2-1)*70;
      p.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        transform:translate(-50%,-50%);
        font: 1000 14px/1 system-ui;
        color:#fff; opacity:.95;
        text-shadow:0 10px 25px rgba(0,0,0,.55);
        transition: transform 420ms ease, opacity 420ms ease;
      `;
      layer.appendChild(p);
      requestAnimationFrame(()=>{
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9)`;
        p.style.opacity = '0';
      });
      setTimeout(()=>{ try{ p.remove(); }catch(_){} }, 520);
    }
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burstAt = burstAt;
})(window);