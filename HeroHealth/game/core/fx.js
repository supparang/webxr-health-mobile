// === Hero Health Academy — core/fx.js (2025-10-30) ===
// Named exports only (no default) เพื่อแก้ error “does not provide a default export”

/* --------- 3D Tilt (สำหรับ emoji เป้า) --------- */
export function add3DTilt(el) {
  try {
    el.style.transform += ' rotateX(8deg) rotateY(-6deg)';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const cx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const cy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.transform = `translate(-50%,-50%) rotateX(${ -cy * 10 }deg) rotateY(${ cx * 12 }deg)`;
    }, { passive: true });
    el.addEventListener('pointerleave', () => {
      el.style.transform = 'translate(-50%,-50%)';
    }, { passive: true });
  } catch {}
}

/* --------- Shatter FX (แตกกระจาย) --------- */
export function shatter3D(x, y) {
  try {
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.textContent = '✦';
      Object.assign(p.style, {
        position: 'fixed',
        left: x + 'px',
        top: y + 'px',
        transform: 'translate(-50%,-50%)',
        fontWeight: '900',
        fontSize: '16px',
        color: '#bde7ff',
        textShadow: '0 2px 8px rgba(0,0,0,.35)',
        transition: 'transform .6s, opacity .6s',
        opacity: '1',
        zIndex: 120,
        pointerEvents: 'none'
      });
      document.body.appendChild(p);

      const dx = (Math.random() - 0.5) * 60;
      const dy = (Math.random() - 0.5) * 40;

      requestAnimationFrame(() => {
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${0.6 + Math.random() * 0.6})`;
        p.style.opacity = '0';
      });

      setTimeout(() => { try { p.remove(); } catch {} }, 620);
    }
  } catch {}
}

/* --------- Glow (ประกายแสง) --------- */
export function glowAt(x, y, color = 'rgba(127,255,212,.45)', ms = 420) {
  try {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%);
      width:20px; height:20px; border-radius:999px;
      background:radial-gradient(${color}, transparent 60%);
      filter:blur(2px); opacity:0.9; pointer-events:none; z-index:115;
      transition:opacity .3s ease, transform .3s ease;
    `;
    document.body.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.opacity = '0';
      dot.style.transform = 'translate(-50%,-50%) scale(1.4)';
    });
    setTimeout(() => { try { dot.remove(); } catch {} }, ms);
  } catch {}
}
