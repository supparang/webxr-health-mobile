// === /herohealth/vr/particles.js ===
// HHA Core FX — SAFE / SHARED
// ใช้ร่วมทุกเกม (GoodJunk / Plate / Groups / Hydration)

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
    layer.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index:120;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x, y, text, cls=''){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.className = `hha-pop ${cls}`;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    layer.appendChild(el);
    setTimeout(()=> el.remove(), 700);
  }

  function burstAt(x,y,kind='good'){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = `hha-burst ${kind}`;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    layer.appendChild(el);
    setTimeout(()=> el.remove(), 600);
  }

  const style = doc.createElement('style');
  style.textContent = `
    .hha-pop{
      position:absolute;
      transform:translate(-50%,-50%);
      font:900 18px/1 system-ui;
      color:#fff;
      text-shadow:0 6px 18px rgba(0,0,0,.55);
      animation:hha-pop 620ms ease-out forwards;
    }
    @keyframes hha-pop{
      0%{opacity:.9; transform:translate(-50%,-40%) scale(.9);}
      60%{opacity:1; transform:translate(-50%,-80%) scale(1.2);}
      100%{opacity:0; transform:translate(-50%,-110%) scale(1);}
    }

    .hha-burst{
      position:absolute;
      width:22px;height:22px;
      border-radius:50%;
      transform:translate(-50%,-50%);
      animation:hha-burst 520ms ease-out forwards;
      pointer-events:none;
    }
    .hha-burst.good{ background:#22c55e; }
    .hha-burst.bad{ background:#ef4444; }
    .hha-burst.star{ background:#facc15; }
    .hha-burst.shield{ background:#38bdf8; }
    .hha-burst.diamond{ background:#a78bfa; }

    @keyframes hha-burst{
      from{opacity:.9; transform:translate(-50%,-50%) scale(.6);}
      to{opacity:0; transform:translate(-50%,-50%) scale(2.4);}
    }
  `;
  doc.head.appendChild(style);

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burstAt = burstAt;
})(window);