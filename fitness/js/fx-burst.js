// === /fitness/js/fx-burst.js ===
// Lightweight DOM FX for Shadow Breaker (no deps)
// ✅ creates #sb-fx-layer automatically (fixed overlay)
// ✅ burst(x,y), popText(x,y,text)
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
    layer.className = 'sb-fx-layer';

    // hard styles (in case css not loaded yet)
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.right = '0';
    layer.style.bottom = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '9999';

    DOC.body.appendChild(layer);
  } else {
    // ensure still on top (in case other scripts changed it)
    try {
      layer.style.pointerEvents = 'none';
      layer.style.zIndex = '9999';
      if (getComputedStyle(layer).position !== 'fixed') layer.style.position = 'fixed';
    } catch {}
  }

  return layer;
}

function setPos(el, x, y) {
  el.style.position = 'absolute';
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

export const FxBurst = {
  burst(x, y, opts = {}) {
    const layer = ensureLayer();
    const n = Math.round(clamp(opts.n ?? 10, 4, 26));
    const spread = clamp(opts.spread ?? 42, 10, 140);
    const ttlMs = clamp(opts.ttlMs ?? 520, 160, 1400);
    const cls = opts.cls || '';

    for (let i = 0; i < n; i++) {
      const dot = document.createElement('div');
      dot.className = 'sb-fx-dot' + (cls ? ' ' + cls : '');

      const dx = rand(-spread, spread);
      const dy = rand(-spread, spread);
      const s  = rand(0.75, 1.25);

      setPos(dot, x, y);
      dot.style.opacity = '1';
      dot.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;

      layer.appendChild(dot);

      const t0 = nowMs();
      const raf = () => {
        const t = nowMs() - t0;
        const p = clamp(t / ttlMs, 0, 1);

        dot.style.opacity = String(1 - p);
        dot.style.transform =
          `translate(${dx * (1 + p*0.15)}px, ${dy * (1 + p*0.15)}px) scale(${s * (1 - p*0.15)})`;

        if (p < 1) {
          try { requestAnimationFrame(raf); }
          catch { setTimeout(raf, 16); }
        } else {
          try { dot.remove(); } catch {}
        }
      };

      try { requestAnimationFrame(raf); }
      catch { setTimeout(raf, 16); }
    }
  },

  popText(x, y, text, cls = '') {
    const layer = ensureLayer();
    const el = document.createElement('div');
    el.className = 'sb-fx-text' + (cls ? ' ' + cls : '');
    el.textContent = text || '';

    // anchor center
    el.style.transform = 'translate(-50%, -18px) scale(1)';
    setPos(el, x, y);

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

      if (p < 1) {
        try { requestAnimationFrame(raf); }
        catch { setTimeout(raf, 16); }
      } else {
        try { el.remove(); } catch {}
      }
    };

    try { requestAnimationFrame(raf); }
    catch { setTimeout(raf, 16); }
  }
};