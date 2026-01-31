// === fitness/js/fx-burst.js ===
// Shadow Breaker — lightweight burst FX (Pack D)
// No dependencies, safe on mobile.
// Usage:
//   FxBurst.popText(x,y,'+100','good')
//   FxBurst.burst(x,y,{count:10})
'use strict';

const DOC = document;

function ensureLayer() {
  let layer = DOC.getElementById('sb-fx-layer');
  if (layer) return layer;
  layer = DOC.createElement('div');
  layer.id = 'sb-fx-layer';
  layer.style.position = 'fixed';
  layer.style.inset = '0';
  layer.style.pointerEvents = 'none';
  layer.style.zIndex = '9999';
  DOC.body.appendChild(layer);
  return layer;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeEl(cls, x, y, text) {
  const el = DOC.createElement('div');
  el.className = cls;
  el.textContent = text || '';
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.willChange = 'transform, opacity';
  return el;
}

export const FxBurst = {
  popText(x, y, text, tone) {
    try {
      const layer = ensureLayer();
      const el = makeEl('sb-fx-text ' + (tone || ''), x, y, text);
      layer.appendChild(el);

      const dx = (Math.random() * 2 - 1) * 18;
      const dy = -18 - Math.random() * 14;

      requestAnimationFrame(() => {
        el.style.opacity = '0';
        el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.02)`;
      });

      setTimeout(() => el.remove(), 520);
    } catch (e) {}
  },

  burst(x, y, opts = {}) {
    try {
      const layer = ensureLayer();
      const count = clamp(opts.count || 10, 4, 18);
      const spread = clamp(opts.spread || 46, 22, 80);

      for (let i = 0; i < count; i++) {
        const dot = makeEl('sb-fx-dot', x, y, '');
        const a = (Math.PI * 2) * (i / count) + (Math.random() * 0.6);
        const r = spread * (0.6 + Math.random() * 0.6);
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        const s = 0.8 + Math.random() * 0.8;

        layer.appendChild(dot);
        requestAnimationFrame(() => {
          dot.style.opacity = '0';
          dot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${s})`;
        });
        setTimeout(() => dot.remove(), 520);
      }
    } catch (e) {}
  }
};