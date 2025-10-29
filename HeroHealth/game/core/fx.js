// === Hero Health Academy — core/fx.js (safe namespace, no redeclare) ===
// Note: export ทั้งแบบ named และ default (FX) เพื่อเรียกใช้ง่าย และให้ dynamic import ในโหมดต่าง ๆ map เข้า window.HHA_FX ได้

export function add3DTilt(el) {
  if (!el) return;
  // ป้องกันผูกซ้ำ
  if (el.__hhaTiltBound) return;
  el.__hhaTiltBound = true;

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    el.style.transform = `translate(-50%,-50%) rotateX(${(-dy * 8).toFixed(2)}deg) rotateY(${(dx * 10).toFixed(2)}deg) translateZ(10px)`;
  };
  const onLeave = () => {
    el.style.transform = 'translate(-50%,-50%)';
  };

  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);
}

export function shatter3D(x, y) {
  try {
    const p = document.createElement('div');
    p.style.position = 'fixed';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.pointerEvents = 'none';
    p.style.transform = 'translate(-50%,-50%)';
    p.style.zIndex = 120;
    p.textContent = '✦';
    p.style.filter = 'drop-shadow(0 0 8px rgba(255,255,255,.6))';
    document.body.appendChild(p);
    // fade + float
    p.animate(
      [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
       { opacity: 0, transform: 'translate(-50%,-90%) scale(0.6)' }],
      { duration: 500, easing: 'ease-out' }
    ).onfinish = () => { try { p.remove(); } catch {} };
  } catch {}
}

export const FX = { add3DTilt, shatter3D };
export default FX;
