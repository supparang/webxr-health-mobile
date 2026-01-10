// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (shared FX layer for all games)
// ✅ popText(x,y,text,cls)
// ✅ burst(x,y,{r,n})
// ✅ shockwave(x,y,{r})
// ✅ celebrate()
// Notes:
// - Safe: auto-creates .hha-fx-layer
// - No external deps

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------- layer ----------
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:90',
      'overflow:hidden',
      'contain:layout style paint',
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + (b - a) * Math.random();

  function addEl(html) {
    const layer = ensureLayer();
    const tmp = doc.createElement('div');
    tmp.innerHTML = html;
    const el = tmp.firstElementChild;
    layer.appendChild(el);
    return el;
  }

  function styleOnce() {
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-pop{
        position:absolute; transform:translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color:#fff; text-shadow:0 10px 28px rgba(0,0,0,.55);
        opacity:.98; will-change: transform, opacity;
        animation: hhaPop 560ms ease-out forwards;
        letter-spacing:.2px;
      }
      .hha-pop.big{ font-size:22px; }
      .hha-pop.perfect{ font-size:20px; transform:translate(-50%,-50%) scale(1.05); }
      .hha-pop.score{ }
      .hha-pop.block{ opacity:.95; }
      .hha-pop.bad{ opacity:.95; }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.92; }
        55%{ transform:translate(-50%,-78%) scale(1.14); opacity:1; }
        100%{ transform:translate(-50%,-96%) scale(1.05); opacity:0; }
      }

      .hha-burst-dot{
        position:absolute; left:0; top:0;
        width:8px; height:8px; border-radius:999px;
        background: rgba(255,255,255,.92);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        animation: hhaDot 520ms cubic-bezier(.2,.9,.2,1) forwards;
        opacity:1;
      }
      @keyframes hhaDot{
        0%{ opacity:1; transform:translate(var(--x0), var(--y0)) scale(.9); }
        85%{ opacity:1; transform:translate(var(--x1), var(--y1)) scale(1); }
        100%{ opacity:0; transform:translate(var(--x1), var(--y1)) scale(.7); }
      }

      .hha-shock{
        position:absolute; left:0; top:0;
        width:18px; height:18px; border-radius:999px;
        border: 2px solid rgba(255,255,255,.55);
        transform: translate(-50%,-50%) scale(.3);
        will-change: transform, opacity;
        animation: hhaShock 560ms ease-out forwards;
        opacity:.95;
      }
      @keyframes hhaShock{
        0%{ opacity:.85; transform:translate(var(--x), var(--y)) scale(.25); filter:blur(.2px); }
        70%{ opacity:.55; transform:translate(var(--x), var(--y)) scale(var(--s)); }
        100%{ opacity:0; transform:translate(var(--x), var(--y)) scale(calc(var(--s) * 1.12)); }
      }

      .hha-cele-dot{
        position:absolute; width:9px; height:9px; border-radius:999px;
        background: rgba(255,255,255,.94);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        animation: hhaCele 900ms cubic-bezier(.18,.86,.22,1) forwards;
        opacity:1;
      }
      @keyframes hhaCele{
        0%{ opacity:1; transform:translate(var(--sx), var(--sy)) scale(.85); }
        65%{ opacity:1; transform:translate(var(--mx), var(--my)) scale(1); }
        100%{ opacity:0; transform:translate(var(--ex), var(--ey)) scale(.8); }
      }
    `;
    doc.head.appendChild(st);
  }

  // ---------- API ----------
  function popText(x, y, text, cls) {
    styleOnce();
    x = Number(x) || innerWidth / 2;
    y = Number(y) || innerHeight / 2;
    const safe = String(text ?? '');
    const c = String(cls || '').trim();

    const el = addEl(
      `<div class="hha-pop ${c}">${safe.replace(/</g, '&lt;')}</div>`
    );
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 650);
  }

  function burst(x, y, opts = {}) {
    styleOnce();
    x = Number(x) || innerWidth / 2;
    y = Number(y) || innerHeight / 2;
    const r = clamp(Number(opts.r ?? 52) || 52, 18, 140);
    const n = clamp(Number(opts.n ?? 10) || 10, 6, 22);

    const layer = ensureLayer();
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + rand(-0.22, 0.22);
      const d1 = rand(r * 0.55, r * 0.95);
      const x1 = x + Math.cos(ang) * d1;
      const y1 = y + Math.sin(ang) * d1;

      const dot = doc.createElement('div');
      dot.className = 'hha-burst-dot';
      dot.style.left = '0px';
      dot.style.top = '0px';
      dot.style.setProperty('--x0', `${x}px`);
      dot.style.setProperty('--y0', `${y}px`);
      dot.style.setProperty('--x1', `${x1}px`);
      dot.style.setProperty('--y1', `${y1}px`);
      dot.style.width = `${rand(6, 10)}px`;
      dot.style.height = dot.style.width;
      layer.appendChild(dot);

      setTimeout(() => {
        try { dot.remove(); } catch (_) {}
      }, 650);
    }
  }

  function shockwave(x, y, opts = {}) {
    styleOnce();
    x = Number(x) || innerWidth / 2;
    y = Number(y) || innerHeight / 2;
    const r = clamp(Number(opts.r ?? 70) || 70, 28, 180);
    const s = clamp(r / 18, 1.6, 10.0);

    const el = addEl(`<div class="hha-shock"></div>`);
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
    el.style.setProperty('--s', String(s));

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 700);

    // tiny burst to feel "impact"
    burst(x, y, { r: clamp(r * 0.6, 22, 120), n: 8 });
  }

  function celebrate() {
    styleOnce();
    const layer = ensureLayer();
    const cx = innerWidth / 2;
    const cy = innerHeight * 0.35;

    const shots = 14;
    for (let i = 0; i < shots; i++) {
      const sx = cx + rand(-40, 40);
      const sy = cy + rand(-30, 30);
      const ex = cx + rand(-220, 220);
      const ey = cy + rand(-160, 160);
      const mx = (sx + ex) / 2 + rand(-40, 40);
      const my = (sy + ey) / 2 - rand(40, 130);

      const dot = doc.createElement('div');
      dot.className = 'hha-cele-dot';
      dot.style.left = '0px';
      dot.style.top = '0px';
      dot.style.setProperty('--sx', `${sx}px`);
      dot.style.setProperty('--sy', `${sy}px`);
      dot.style.setProperty('--mx', `${mx}px`);
      dot.style.setProperty('--my', `${my}px`);
      dot.style.setProperty('--ex', `${ex}px`);
      dot.style.setProperty('--ey', `${ey}px`);
      dot.style.width = `${rand(7, 11)}px`;
      dot.style.height = dot.style.width;
      layer.appendChild(dot);

      setTimeout(() => {
        try { dot.remove(); } catch (_) {}
      }, 1200);
    }
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;
})(window);