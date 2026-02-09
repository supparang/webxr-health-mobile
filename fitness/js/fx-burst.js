// === /fitness/js/fx-burst.js ===
// Lightweight DOM FX for Shadow Breaker (no deps)
// ✅ creates #sb-fx-layer automatically
// ✅ burst(x,y), popText(x,y,text)
// Export: FxBurst
// PATCH D:
// ✅ Layer has inline base styles (so FX won't disappear if CSS missing/overridden)
// ✅ Strong z-index + pointer-events none
// ✅ Safe RAF + performance fallback

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min, max){ return min + Math.random() * (max - min); }
function nowMs(){ try { return performance.now(); } catch { return Date.now(); } }

function ensureLayer() {
  const DOC = document;
  let layer = DOC.getElementById('sb-fx-layer');
  if (!layer) {
    layer = DOC.createElement('div');
    layer.id = 'sb-fx-layer';

    // ✅ Base inline styles (self-contained)
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '99999';
    layer.style.overflow = 'hidden';

    DOC.body.appendChild(layer);
  } else {
    // ensure critical properties even if something else touched it
    layer.style.pointerEvents = 'none';
    layer.style.position = 'fixed';
    layer.style.zIndex = layer.style.zIndex || '99999';
  }
  return layer;
}

function setPos(el, x, y) {
  el.style.position = 'absolute';
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

function ensureDotBaseStyle(dot){
  // In case CSS class missing, provide minimal look so FX still visible
  if (!dot.style.width) dot.style.width = '10px';
  if (!dot.style.height) dot.style.height = '10px';
  if (!dot.style.borderRadius) dot.style.borderRadius = '999px';
  if (!dot.style.background) dot.style.background = 'rgba(255,255,255,.92)';
  dot.style.willChange = 'transform, opacity';
}

function ensureTextBaseStyle(el){
  // Minimal pill text style (if CSS missing)
  el.style.fontWeight = '900';
  el.style.letterSpacing = '.2px';
  el.style.padding = '6px 10px';
  el.style.borderRadius = '999px';
  el.style.background = el.style.background || 'rgba(2,6,23,.55)';
  el.style.border = el.style.border || '1px solid rgba(148,163,184,.25)';
  el.style.color = el.style.color || 'rgba(255,255,255,.95)';
  el.style.textShadow = '0 1px 10px rgba(0,0,0,.35)';
  el.style.backdropFilter = 'blur(8px)';
  el.style.webkitBackdropFilter = 'blur(8px)';
  el.style.willChange = 'transform, opacity';
}

export const FxBurst = {
  burst(x, y, opts = {}) {
    const layer = ensureLayer();

    const n = Math.round(clamp(opts.n ?? 10, 4, 26));
    const spread = clamp(opts.spread ?? 42, 10, 120);
    const ttlMs = clamp(opts.ttlMs ?? 520, 200, 1200);
    const cls = opts.cls || '';

    for (let i = 0; i < n; i++) {
      const dot = document.createElement('div');
      dot.className = 'sb-fx-dot' + (cls ? ' ' + cls : '');

      const dx = rand(-spread, spread);
      const dy = rand(-spread, spread);
      const s = rand(0.85, 1.25);

      setPos(dot, x, y);
      ensureDotBaseStyle(dot);

      dot.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      dot.style.opacity = '1';

      layer.appendChild(dot);

      const t0 = nowMs();
      const raf = () => {
        const t = nowMs() - t0;
        const p = clamp(t / ttlMs, 0, 1);

        dot.style.opacity = String(1 - p);
        dot.style.transform =
          `translate(${dx * (1 + p*0.15)}px, ${dy * (1 + p*0.15)}px) scale(${s * (1 - p*0.15)})`;

        if (p < 1) requestAnimationFrame(raf);
        else { try { dot.remove(); } catch {} }
      };

      requestAnimationFrame(raf);
    }
  },

  popText(x, y, text, cls = '') {
    const layer = ensureLayer();

    const el = document.createElement('div');
    el.className = 'sb-fx-text' + (cls ? ' ' + cls : '');
    el.textContent = text || '';

    setPos(el, x, y);
    ensureTextBaseStyle(el);

    // anchor to center
    el.style.transform = 'translate(-50%, -18px) scale(1)';
    el.style.opacity = '1';

    layer.appendChild(el);

    const ttlMs = 820;
    const t0 = nowMs();
    const startY = y;

    const raf = () => {
      const t = nowMs() - t0;
      const p = clamp(t / ttlMs, 0, 1);

      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%, ${(-18 - 24*p)}px) scale(${1 + 0.08*(1-p)})`;
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(startY) + 'px';

      if (p < 1) requestAnimationFrame(raf);
      else { try { el.remove(); } catch {} }
    };

    requestAnimationFrame(raf);
  }
};