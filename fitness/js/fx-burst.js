// === /fitness/js/fx-burst.js ===
// Lightweight DOM FX for Shadow Breaker (no deps)
// ✅ creates #sb-fx-layer automatically
// ✅ burst(x,y), popText(x,y,text)
// ✅ PATCH: smaller + less spread + no giant overlay feeling
// Export: FxBurst

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min, max){ return min + Math.random() * (max - min); }

function ensureLayer() {
  const DOC = document;
  let layer = DOC.getElementById('sb-fx-layer');
  if (!layer) {
    layer = DOC.createElement('div');
    layer.id = 'sb-fx-layer';

    // ✅ PATCH: enforce safe layer style here too (in case CSS missing)
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.right = '0';
    layer.style.bottom = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '9999';

    (DOC.body || DOC.documentElement).appendChild(layer);
  }
  return layer;
}

function setPos(el, x, y) {
  el.style.position = 'absolute';
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

export const FxBurst = {
  burst(x, y, opts = {}) {
    const layer = ensureLayer();

    // ✅ PATCH: keep defaults smaller (dom-renderer can still override)
    const n = Math.round(clamp(opts.n ?? 9, 4, 22));
    const spread = clamp(opts.spread ?? 34, 10, 90);
    const ttlMs = clamp(opts.ttlMs ?? 520, 200, 1100);
    const cls = opts.cls || '';

    // tiny jitter so repeated hits don’t stack exactly at same pixel
    const jx = rand(-2.5, 2.5);
    const jy = rand(-2.5, 2.5);
    const bx = x + jx;
    const by = y + jy;

    for (let i = 0; i < n; i++) {
      const dot = document.createElement('div');
      dot.className = 'sb-fx-dot' + (cls ? ' ' + cls : '');

      // ✅ PATCH: reduce end distance + scale so it doesn't become huge ring
      const dx = rand(-spread, spread);
      const dy = rand(-spread, spread);
      const s0 = rand(0.85, 1.15);

      setPos(dot, bx, by);

      // start compact
      dot.style.opacity = '1';
      dot.style.transform = `translate(0px, 0px) scale(${s0 * 0.85})`;

      layer.appendChild(dot);

      const t0 = performance.now();

      const raf = () => {
        const t = performance.now() - t0;
        const p = clamp(t / ttlMs, 0, 1);

        // ease-out movement
        const ease = 1 - Math.pow(1 - p, 2);

        // fade and slightly shrink
        dot.style.opacity = String(1 - p);
        dot.style.transform =
          `translate(${dx * ease}px, ${dy * ease}px) scale(${(s0 * (1 - 0.20*p)).toFixed(4)})`;

        if (p < 1) requestAnimationFrame(raf);
        else dot.remove();
      };

      requestAnimationFrame(raf);
    }
  },

  popText(x, y, text, cls = '') {
    const layer = ensureLayer();

    const el = document.createElement('div');
    el.className = 'sb-fx-text' + (cls ? ' ' + cls : '');
    el.textContent = text || '';

    // anchor to center of x,y
    setPos(el, x, y);
    el.style.transform = 'translate(-50%, -16px) scale(1)';
    el.style.opacity = '1';

    layer.appendChild(el);

    // ✅ PATCH: shorter travel so it won't block HUD
    const ttlMs = 760;
    const t0 = performance.now();
    const startY = y;

    const raf = () => {
      const t = performance.now() - t0;
      const p = clamp(t / ttlMs, 0, 1);

      // ease-out float
      const ease = 1 - Math.pow(1 - p, 2);

      // move up modestly (max ~28px)
      const dy = (-16 - 28 * ease);

      el.style.opacity = String(1 - p);
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(startY) + 'px';
      el.style.transform = `translate(-50%, ${dy}px) scale(${(1 + 0.05*(1-p)).toFixed(4)})`;

      if (p < 1) requestAnimationFrame(raf);
      else el.remove();
    };

    requestAnimationFrame(raf);
  }
};