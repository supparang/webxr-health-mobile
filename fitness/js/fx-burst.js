// === /fitness/js/fx-burst.js ===
// Lightweight DOM FX burst + popText
// Usage:
//   FxBurst.burst(x,y,{count,cls})
//   FxBurst.popText(x,y,text,cls)

'use strict';

const DOC = document;

function ensureLayer(){
  let layer = DOC.getElementById('sb-fx-layer');
  if (layer) return layer;
  layer = DOC.createElement('div');
  layer.id = 'sb-fx-layer';
  layer.style.position = 'fixed';
  layer.style.left = '0';
  layer.style.top = '0';
  layer.style.width = '100%';
  layer.style.height = '100%';
  layer.style.pointerEvents = 'none';
  layer.style.zIndex = '9999';
  DOC.body.appendChild(layer);
  return layer;
}

function makeDot(x,y,cls){
  const d = DOC.createElement('div');
  d.className = `sb-fx-dot ${cls||''}`.trim();
  d.style.position = 'fixed';
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  d.style.transform = 'translate(-50%,-50%)';
  return d;
}

export const FxBurst = {
  burst(x, y, opts = {}) {
    const layer = ensureLayer();
    const count = Math.max(4, Math.min(24, Number(opts.count) || 10));
    const cls = opts.cls || '';

    for (let i = 0; i < count; i++) {
      const d = makeDot(x, y, cls);
      const ang = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 42;
      const dx = Math.cos(ang) * r;
      const dy = Math.sin(ang) * r;

      layer.appendChild(d);

      d.animate([
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.35)` }
      ], { duration: 520 + Math.random() * 180, easing: 'cubic-bezier(.2,.9,.2,1)' })
      .onfinish = () => d.remove();
    }
  },

  popText(x, y, text, cls = '') {
    const layer = ensureLayer();
    const t = DOC.createElement('div');
    t.className = `sb-fx-text ${cls}`.trim();
    t.textContent = text;
    t.style.position = 'fixed';
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
    t.style.transform = 'translate(-50%,-50%)';
    t.style.pointerEvents = 'none';

    layer.appendChild(t);

    t.animate([
      { opacity: 0, transform: 'translate(-50%,-40%) scale(0.92)' },
      { opacity: 1, transform: 'translate(-50%,-60%) scale(1.03)' },
      { opacity: 0, transform: 'translate(-50%,-100%) scale(1.03)' },
    ], { duration: 900, easing: 'cubic-bezier(.2,.9,.2,1)' })
    .onfinish = () => t.remove();
  }
};