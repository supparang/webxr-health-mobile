// === /fitness/js/fx-burst.js ===
// Lightweight DOM FX for Shadow Breaker (no deps)
// ✅ creates #sb-fx-layer automatically
// ✅ burst(x,y), popText(x,y,text)
// Export: FxBurst (ES module)

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function isNum(v){ return Number.isFinite(Number(v)); }
function n(v, d){ v = Number(v); return Number.isFinite(v) ? v : d; }

function ensureLayer() {
  const DOC = document;
  let layer = DOC.getElementById('sb-fx-layer');
  if (!layer) {
    layer = DOC.createElement('div');
    layer.id = 'sb-fx-layer';

    // minimal safe style (in case CSS missing/late)
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.right = '0';
    layer.style.bottom = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '9999';

    DOC.body.appendChild(layer);
  }
  return layer;
}

function setPos(el, x, y) {
  el.style.position = 'absolute';
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

function rand(min, max){ return min + Math.random() * (max - min); }

export const FxBurst = {
  burst(x, y, opts = {}) {
    const layer = ensureLayer();

    const px = isNum(x) ? Number(x) : window.innerWidth/2;
    const py = isNum(y) ? Number(y) : window.innerHeight/2;

    const nDots  = Math.round(clamp(opts.n ?? 10, 4, 26));
    const spread = clamp(opts.spread ?? 42, 10, 140);
    const ttlMs  = clamp(opts.ttlMs ?? 520, 200, 1400);
    const cls    = opts.cls || '';

    for (let i = 0; i < nDots; i++) {
      const dot = document.createElement('div');
      dot.className = 'sb-fx-dot' + (cls ? ' ' + cls : '');

      const dx = rand(-spread, spread);
      const dy = rand(-spread, spread);
      const s  = rand(0.78, 1.25);

      setPos(dot, px, py);
      dot.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      dot.style.opacity = '1';

      layer.appendChild(dot);

      const t0 = performance.now();
      const raf = () => {
        const t = performance.now() - t0;
        const p = clamp(t / ttlMs, 0, 1);

        dot.style.opacity = String(1 - p);
        dot.style.transform =
          `translate(${dx * (1 + p*0.12)}px, ${dy * (1 + p*0.12)}px) ` +
          `scale(${s * (1 - p*0.12)})`;

        if (p < 1) requestAnimationFrame(raf);
        else dot.remove();
      };
      requestAnimationFrame(raf);
    }
  },

  popText(x, y, text, cls = '') {
    const layer = ensureLayer();

    const px = isNum(x) ? Number(x) : window.innerWidth/2;
    const py = isNum(y) ? Number(y) : window.innerHeight/2;

    const el = document.createElement('div');
    el.className = 'sb-fx-text' + (cls ? ' ' + cls : '');
    el.textContent = text || '';

    // anchor center
    setPos(el, px, py);
    el.style.transform = 'translate(-50%, -18px) scale(1)';
    el.style.opacity = '1';

    layer.appendChild(el);

    const ttlMs = clamp(n((text && text.length > 10) ? 980 : 820, 820), 520, 1400);
    const t0 = performance.now();

    const raf = () => {
      const t = performance.now() - t0;
      const p = clamp(t / ttlMs, 0, 1);

      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%, ${(-18 - 26*p)}px) scale(${1 + 0.08*(1-p)})`;
      el.style.left = Math.round(px) + 'px';
      el.style.top  = Math.round(py) + 'px';

      if (p < 1) requestAnimationFrame(raf);
      else el.remove();
    };

    requestAnimationFrame(raf);
  }
};