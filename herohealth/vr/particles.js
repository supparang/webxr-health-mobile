// === /herohealth/vr/particles.js ===
// Particles / FX Layer — PRODUCTION (ULTRA but light)
// Provides: window.Particles + window.GAME_MODULES.Particles
// ✅ popText(x,y,text,cls,opts)
// ✅ burstAt(x,y,kind,opts)
// ✅ ringPulse(x,y,kind,opts)
// ✅ celebrate(kind,opts)
// ✅ pointer-events none, z-index high, safe cleanup

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const NS = root.GAME_MODULES || (root.GAME_MODULES = {});
  if (NS.Particles) { root.Particles = NS.Particles; return; }

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const now = () => (root.performance ? performance.now() : Date.now());
  const r01 = () => Math.random();

  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:190',
      'overflow:hidden'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  function mkEl(tag, cssText) {
    const el = doc.createElement(tag);
    if (cssText) el.style.cssText = cssText;
    return el;
  }

  function kindColor(kind) {
    // no hard dependency on CSS variables
    switch (String(kind || '').toLowerCase()) {
      case 'good': return 'rgba(34,197,94,.98)';
      case 'bad': return 'rgba(239,68,68,.98)';
      case 'warn': return 'rgba(245,158,11,.98)';
      case 'cyan':
      case 'shield': return 'rgba(34,211,238,.98)';
      case 'violet':
      case 'diamond': return 'rgba(167,139,250,.98)';
      case 'star': return 'rgba(245,158,11,.98)';
      default: return 'rgba(229,231,235,.98)';
    }
  }

  function killLater(el, ms) {
    setTimeout(() => { try { el.remove(); } catch (_) {} }, ms);
  }

  // ---------- FX: popText ----------
  function popText(x, y, text, cls = null, opts = null) {
    const layer = ensureLayer();
    const size = clamp(Number(opts?.size || 18), 12, 44);
    const life = clamp(Number(opts?.lifeMs || 650), 260, 1500);
    const rise = clamp(Number(opts?.risePx || 44), 16, 120);
    const col = opts?.color || kindColor(cls);

    const el = mkEl('div');
    el.textContent = String(text ?? '');
    el.style.cssText = [
      'position:absolute',
      `left:${Math.floor(x)}px`,
      `top:${Math.floor(y)}px`,
      'transform:translate(-50%,-50%)',
      `color:${col}`,
      `font: 1000 ${size}px/1 system-ui, -apple-system, "Segoe UI", sans-serif`,
      'letter-spacing:.3px',
      'text-shadow: 0 8px 28px rgba(0,0,0,.50), 0 1px 0 rgba(0,0,0,.25)',
      'opacity:0',
      'will-change: transform, opacity',
    ].join(';');

    layer.appendChild(el);

    // animate
    const t0 = now();
    const amp = (opts?.scale || 1.04);
    function raf() {
      const t = now() - t0;
      const p = clamp(t / life, 0, 1);
      // ease out
      const e = 1 - Math.pow(1 - p, 3);
      const yy = -rise * e;
      const sc = 1 + (amp - 1) * (1 - p);
      const op = p < 0.10 ? (p / 0.10) : (p > 0.85 ? (1 - p) / 0.15 : 1);
      el.style.opacity = String(op);
      el.style.transform = `translate(-50%,-50%) translate(0px, ${yy}px) scale(${sc})`;
      if (p < 1) requestAnimationFrame(raf);
      else { try { el.remove(); } catch (_) {} }
    }
    requestAnimationFrame(raf);
  }

  // ---------- FX: ringPulse ----------
  function ringPulse(x, y, kind = 'good', opts = null) {
    const layer = ensureLayer();
    const size = clamp(Number(opts?.size || 160), 80, 520);
    const life = clamp(Number(opts?.lifeMs || 520), 240, 1500);
    const col = opts?.color || kindColor(kind);
    const thick = clamp(Number(opts?.thick || 10), 6, 18);

    const el = mkEl('div');
    el.style.cssText = [
      'position:absolute',
      `left:${Math.floor(x)}px`,
      `top:${Math.floor(y)}px`,
      'transform:translate(-50%,-50%) scale(.90)',
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:999px',
      `border:${thick}px solid ${col}`,
      'opacity:0',
      'box-shadow: 0 0 0 14px rgba(0,0,0,.0)',
      'will-change: transform, opacity, box-shadow',
      'filter: drop-shadow(0 12px 26px rgba(0,0,0,.35))',
    ].join(';');

    layer.appendChild(el);
    const t0 = now();
    function raf() {
      const t = now() - t0;
      const p = clamp(t / life, 0, 1);
      const e = 1 - Math.pow(1 - p, 2.7);
      const sc = 0.90 + 0.34 * e;
      const op = p < 0.15 ? (p / 0.15) : (p > 0.75 ? (1 - p) / 0.25 : 1);
      el.style.opacity = String(op);
      el.style.transform = `translate(-50%,-50%) scale(${sc})`;
      el.style.boxShadow = `0 0 0 ${Math.floor(10 + 18 * e)}px rgba(0,0,0,0)`;
      if (p < 1) requestAnimationFrame(raf);
      else { try { el.remove(); } catch (_) {} }
    }
    requestAnimationFrame(raf);
  }

  // ---------- FX: burstAt ----------
  function burstAt(x, y, kind = 'good', opts = null) {
    const layer = ensureLayer();
    const col = opts?.color || kindColor(kind);
    const count = clamp(Number(opts?.count || 12), 6, 40);
    const life = clamp(Number(opts?.lifeMs || 520), 240, 1200);
    const spread = clamp(Number(opts?.spread || 90), 40, 180);
    const sizeMin = clamp(Number(opts?.sizeMin || 6), 3, 12);
    const sizeMax = clamp(Number(opts?.sizeMax || 12), sizeMin, 22);

    for (let i = 0; i < count; i++) {
      const a = r01() * Math.PI * 2;
      const d = spread * (0.35 + 0.65 * r01());
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      const s = sizeMin + (sizeMax - sizeMin) * r01();

      const el = mkEl('div');
      el.style.cssText = [
        'position:absolute',
        `left:${Math.floor(x)}px`,
        `top:${Math.floor(y)}px`,
        'transform:translate(-50%,-50%)',
        `width:${Math.floor(s)}px`,
        `height:${Math.floor(s)}px`,
        'border-radius: 999px',
        `background:${col}`,
        'opacity:0',
        'will-change: transform, opacity',
        'filter: drop-shadow(0 10px 18px rgba(0,0,0,.30))'
      ].join(';');

      layer.appendChild(el);

      const t0 = now();
      function raf() {
        const t = now() - t0;
        const p = clamp(t / life, 0, 1);
        const e = 1 - Math.pow(1 - p, 3);
        const ox = dx * e;
        const oy = dy * e + 10 * e * e; // tiny gravity
        const op = p < 0.10 ? (p / 0.10) : (p > 0.75 ? (1 - p) / 0.25 : 1);
        const sc = 1 - 0.22 * p;
        el.style.opacity = String(op);
        el.style.transform = `translate(-50%,-50%) translate(${ox}px, ${oy}px) scale(${sc})`;
        if (p < 1) requestAnimationFrame(raf);
        else { try { el.remove(); } catch (_) {} }
      }
      requestAnimationFrame(raf);
    }
  }

  // ---------- FX: celebrate ----------
  function celebrate(kind = 'win', opts = null) {
    const layer = ensureLayer();
    const W = doc.documentElement.clientWidth || 360;
    const H = doc.documentElement.clientHeight || 640;

    const baseCount = (kind === 'boss') ? 26 : (kind === 'win') ? 20 : 14;
    const count = clamp(Number(opts?.count || baseCount), 10, 60);

    const colors = [
      'rgba(34,197,94,.98)',
      'rgba(34,211,238,.98)',
      'rgba(245,158,11,.98)',
      'rgba(167,139,250,.98)',
      'rgba(229,231,235,.98)'
    ];

    for (let i = 0; i < count; i++) {
      const x = W * (0.15 + 0.70 * r01());
      const y = H * (0.10 + 0.25 * r01());
      const col = colors[(Math.random() * colors.length) | 0];
      burstAt(x, y, 'good', { color: col, count: 10, spread: 120, lifeMs: 720 });
      ringPulse(x, y, 'star', { color: col, size: 220, lifeMs: 720, thick: 10 });
    }

    // soft flash
    const flash = mkEl('div', [
      'position:absolute',
      'inset:0',
      'background: rgba(255,255,255,.08)',
      'opacity:0',
      'transition: opacity 120ms ease-out',
    ].join(';'));
    layer.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '1'; });
    killLater(flash, 220);
  }

  const api = { popText, burstAt, ringPulse, celebrate };

  NS.Particles = api;
  root.Particles = api;

})(window);