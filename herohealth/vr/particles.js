// === /herohealth/vr/particles.js ===
// Minimal FX layer — safe

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x,y,text){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui; color:#fff;
      text-shadow: 0 8px 22px rgba(0,0,0,.55);
      opacity:.98;
      will-change: transform, opacity;
      animation: hhaPop 520ms ease-out forwards;
    `;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 600);
  }

  const st = doc.createElement('style');
  st.textContent = `
    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.9); opacity:.95; }
      70%{ transform:translate(-50%,-70%) scale(1.2); opacity:1; }
      100%{ transform:translate(-50%,-90%) scale(1.05); opacity:0; }
    }
  `;
  doc.head.appendChild(st);

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
})(window);