// === /herohealth/vr/particles.js ===
// HHA FX Core — PRODUCTION (unified for all games)
// ✅ Safe (never throws)
// ✅ Provides: burstAt(x,y,kind), scorePop(x,y,text), popText(x,y,text), flash(kind), ring(x,y,kind), test()
// ✅ Aliases: window.Particles + window.GAME_MODULES.Particles + window.HHA_FX
// Notes:
// - pointer-events:none so it won't block HUD/buttons
// - z-index intentionally high so FX is always visible

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_CORE__) return;
  root.__HHA_PARTICLES_CORE__ = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const rnd = (a, b) => a + Math.random() * (b - a);

  function ensureStyle() {
    if (doc.getElementById('hha-fx-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-fx-style';
    st.textContent = `
      .hha-fx-layer{
        position:fixed; inset:0;
        pointer-events:none;
        z-index: 999; /* above everything */
        overflow:hidden;
        contain: layout paint;
      }
      .hha-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        color:#fff;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 540ms ease-out forwards;
      }
      .hha-fx-score{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 1000 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        color:#e5e7eb;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        letter-spacing:.3px;
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaScore 620ms cubic-bezier(.2,.9,.2,1) forwards;
      }
      .hha-fx-piece{
        position:absolute;
        width: 8px; height: 8px;
        border-radius: 999px;
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaPiece 620ms ease-out forwards;
      }
      .hha-fx-ring{
        position:absolute;
        width: 44px; height: 44px;
        border-radius: 999px;
        border: 2px solid rgba(229,231,235,.9);
        transform: translate(-50%,-50%) scale(.7);
        opacity:.0;
        will-change: transform, opacity;
        animation: hhaRing 420ms ease-out forwards;
        filter: drop-shadow(0 10px 22px rgba(0,0,0,.35));
      }
      .hha-fx-flash{
        position:fixed; inset:0;
        background: rgba(255,255,255,.08);
        opacity:0;
        animation: hhaFlash 180ms ease-out forwards;
      }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.92; }
        70%{ transform:translate(-50%,-75%) scale(1.14); opacity:1; }
        100%{ transform:translate(-50%,-98%) scale(1.06); opacity:0; }
      }
      @keyframes hhaScore{
        0%{ transform:translate(-50%,-50%) scale(.95); opacity:.92; }
        35%{ transform:translate(-50%,-70%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-108%) scale(1.08); opacity:0; }
      }
      @keyframes hhaPiece{
        0%{ transform: translate(-50%,-50%) scale(.9); opacity:.95; }
        100%{ transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.6); opacity:0; }
      }
      @keyframes hhaRing{
        0%{ transform:translate(-50%,-50%) scale(.65); opacity:.0; }
        20%{ opacity:.9; }
        100%{ transform:translate(-50%,-50%) scale(1.55); opacity:0; }
      }
      @keyframes hhaFlash{
        0%{ opacity:0; }
        35%{ opacity:1; }
        100%{ opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  }

  function ensureLayer() {
    ensureStyle();
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    doc.body.appendChild(layer);
    return layer;
  }

  function colorOf(kind) {
    switch (String(kind || '').toLowerCase()) {
      case 'good': return ['#22c55e','#a7f3d0','#34d399'];
      case 'bad': return ['#ef4444','#fecaca','#fb7185'];
      case 'star': return ['#fbbf24','#fde68a','#f59e0b'];
      case 'shield': return ['#22d3ee','#a5f3fc','#06b6d4'];
      case 'diamond': return ['#a78bfa','#ddd6fe','#8b5cf6'];
      case 'block': return ['#22d3ee','#e0f2fe','#60a5fa'];
      default: return ['#e5e7eb','#cbd5e1','#94a3b8'];
    }
  }

  function popText(x, y, text) {
    try {
      const layer = ensureLayer();
      const el = doc.createElement('div');
      el.className = 'hha-fx-pop';
      el.textContent = String(text || '');
      el.style.left = `${Math.round(x)}px`;
      el.style.top  = `${Math.round(y)}px`;
      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 650);
    } catch (_) {}
  }

  function scorePop(x, y, text) {
    try {
      const layer = ensureLayer();
      const el = doc.createElement('div');
      el.className = 'hha-fx-score';
      el.textContent = String(text || '');
      el.style.left = `${Math.round(x)}px`;
      el.style.top  = `${Math.round(y)}px`;
      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 760);
    } catch (_) {}
  }

  function ring(x, y, kind) {
    try {
      const layer = ensureLayer();
      const el = doc.createElement('div');
      el.className = 'hha-fx-ring';
      const cols = colorOf(kind);
      el.style.borderColor = cols[0] || 'rgba(229,231,235,.9)';
      el.style.left = `${Math.round(x)}px`;
      el.style.top  = `${Math.round(y)}px`;
      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 520);
    } catch (_) {}
  }

  function burstAt(x, y, kind) {
    try {
      const layer = ensureLayer();
      const cols = colorOf(kind);
      const n = (kind === 'bad') ? 10 : (kind === 'diamond') ? 18 : 14;
      ring(x, y, kind);

      for (let i = 0; i < n; i++) {
        const p = doc.createElement('div');
        p.className = 'hha-fx-piece';
        p.style.left = `${Math.round(x)}px`;
        p.style.top  = `${Math.round(y)}px`;

        const dx = rnd(-120, 120);
        const dy = rnd(-120, 120);
        p.style.setProperty('--dx', `${dx.toFixed(1)}px`);
        p.style.setProperty('--dy', `${dy.toFixed(1)}px`);

        const c = cols[Math.floor(Math.random() * cols.length)] || '#e5e7eb';
        p.style.background = c;

        const s = rnd(6, 10);
        p.style.width = `${s.toFixed(1)}px`;
        p.style.height = `${s.toFixed(1)}px`;

        layer.appendChild(p);
        setTimeout(() => { try { p.remove(); } catch (_) {} }, 760);
      }
    } catch (_) {}
  }

  function flash(kind) {
    try {
      const layer = ensureLayer();
      const el = doc.createElement('div');
      el.className = 'hha-fx-flash';
      const cols = colorOf(kind);
      const c = cols[0] || '#fff';
      el.style.background = `radial-gradient(circle at 50% 50%, ${c}22, transparent 62%)`;
      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 260);
    } catch (_) {}
  }

  function test() {
    try {
      const W = doc.documentElement.clientWidth;
      const H = doc.documentElement.clientHeight;
      const x = Math.round(W / 2);
      const y = Math.round(H / 2);
      burstAt(x, y, 'good');
      scorePop(x, y, '+13');
      setTimeout(() => burstAt(x, y, 'bad'), 220);
      setTimeout(() => burstAt(x, y, 'star'), 440);
      setTimeout(() => burstAt(x, y, 'shield'), 660);
      setTimeout(() => burstAt(x, y, 'diamond'), 880);
      setTimeout(() => flash('good'), 980);
    } catch (_) {}
  }

  // Expose (compat)
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;
  root.Particles.ring = ring;
  root.Particles.flash = flash;
  root.Particles.test = test;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

  root.HHA_FX = root.Particles;

  // Tiny global test helper
  root.HHA_FX_TEST = test;

})(window);