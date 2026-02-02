// === /fitness/js/fx-burst.js ===
// Lightweight DOM FX for Shadow Breaker (no deps)
// ✅ creates #sb-fx-layer automatically (fixed overlay)
// ✅ burst(x,y), popText(x,y,text)
// Export: FxBurst
// ✅ PATCH: self-style fallback so FX won't "disappear" even if CSS missing

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min, max){ return min + Math.random() * (max - min); }

function ensureLayer() {
  const DOC = document;
  let layer = DOC.getElementById('sb-fx-layer');
  if (!layer) {
    layer = DOC.createElement('div');
    layer.id = 'sb-fx-layer';

    // --- fallback styles (important!) ---
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.right = '0';
    layer.style.bottom = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '999999'; // higher than any HUD
    layer.style.overflow = 'visible';

    DOC.body.appendChild(layer);
  } else {
    // keep safe if some CSS/JS overwrote it
    if (!layer.style.position) layer.style.position = 'fixed';
    if (!layer.style.pointerEvents) layer.style.pointerEvents = 'none';
    if (!layer.style.zIndex) layer.style.zIndex = '999999';
  }
  return layer;
}

function setPos(el, x, y) {
  el.style.position = 'absolute';
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

function applyDotFallback(dot){
  // If CSS is missing, still visible
  dot.style.width = dot.style.width || '12px';
  dot.style.height = dot.style.height || '12px';
  dot.style.borderRadius = dot.style.borderRadius || '999px';
  dot.style.background = dot.style.background || 'rgba(255,255,255,.92)';
  dot.style.boxShadow = dot.style.boxShadow || '0 0 18px rgba(255,255,255,.35)';
  dot.style.willChange = 'transform, opacity';
}

function applyTextFallback(el){
  el.style.fontWeight = el.style.fontWeight || '900';
  el.style.padding = el.style.padding || '6px 10px';
  el.style.borderRadius = el.style.borderRadius || '999px';
  el.style.background = el.style.background || 'rgba(2,6,23,.55)';
  el.style.border = el.style.border || '1px solid rgba(148,163,184,.25)';
  el.style.color = el.style.color || 'rgba(255,255,255,.95)';
  el.style.textShadow = el.style.textShadow || '0 1px 10px rgba(0,0,0,.35)';
  el.style.backdropFilter = el.style.backdropFilter || 'blur(8px)';
  el.style.webkitBackdropFilter = el.style.webkitBackdropFilter || 'blur(8px)';
  el.style.willChange = 'transform, opacity';
}

export const FxBurst = {
  burst(x, y, opts = {}) {
    const layer = ensureLayer();

    const n = Math.round(clamp(opts.n ?? 10, 4, 26));
    const spread = clamp(opts.spread ?? 42, 10, 140);   // allow more punch
    const ttlMs = clamp(opts.ttlMs ?? 520, 200, 1400);
    const cls = opts.cls || '';

    for (let i = 0; i < n; i++) {
      const dot = document.createElement('div');
      dot.className = 'sb-fx-dot' + (cls ? ' ' + cls : '');

      // fallback style to prevent invisible FX
      applyDotFallback(dot);

      const dx = rand(-spread, spread);
      const dy = rand(-spread, spread);
      const s = rand(0.85, 1.35);

      setPos(dot, x, y);

      // start at center then animate outward
      dot.style.transform = `translate(0px, 0px) scale(${s})`;
      dot.style.opacity = '1';

      layer.appendChild(dot);

      const t0 = performance.now();
      const raf = () => {
        const t = performance.now() - t0;
        const p = clamp(t / ttlMs, 0, 1);

        // ease-out
        const e = 1 - Math.pow(1 - p, 2);

        dot.style.opacity = String(1 - p);
        dot.style.transform =
          `translate(${dx * e}px, ${dy * e}px) scale(${s * (1 - 0.20*p)})`;

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

    applyTextFallback(el);
    setPos(el, x, y);
    layer.appendChild(el);

    const ttlMs = 900;
    const t0 = performance.now();

    // anchor to center
    el.style.transform = 'translate(-50%, -18px) scale(1)';
    el.style.opacity = '1';

    const raf = () => {
      const t = performance.now() - t0;
      const p = clamp(t / ttlMs, 0, 1);

      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%, ${(-18 - 30*p)}px) scale(${1 + 0.10*(1-p)})`;

      if (p < 1) requestAnimationFrame(raf);
      else el.remove();
    };
    requestAnimationFrame(raf);
  }
};