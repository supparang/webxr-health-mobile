// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// World-shift look for GoodJunk — FIXED
// ✅ ไม่ขยับตามเมาส์ “เฉยๆ” อีกต่อไป
// ✅ ขยับเฉพาะตอนลาก (pointerdown แล้วลาก)
// ✅ ปิดได้ด้วย ?look=0

export function attachTouchLook(opts = {}){
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const doc = root.document;
  if (!doc) return () => {};

  const q = new URL(root.location.href).searchParams;
  if (String(q.get('look') ?? '1') === '0') return () => {};

  const stage = doc.getElementById('gj-stage') || doc.querySelector('#gj-stage') || doc.body;
  if (!stage) return () => {};

  const maxShift = Number(opts.maxShift ?? 22); // px
  const maxRot = Number(opts.maxRot ?? 2.0);    // deg

  let down = false;
  let p0x = 0, p0y = 0;
  let sx = 0, sy = 0;

  function apply(){
    stage.style.transform = `translate(${sx}px, ${sy}px) rotateY(${(-sx/maxShift)*maxRot}deg) rotateX(${(sy/maxShift)*maxRot}deg)`;
  }

  function onDown(e){
    down = true;
    p0x = e.clientX;
    p0y = e.clientY;
    stage.setPointerCapture?.(e.pointerId);
  }

  function onMove(e){
    if (!down) return; // ✅ สำคัญ: ไม่ขยับถ้าไม่ได้ลาก
    const dx = e.clientX - p0x;
    const dy = e.clientY - p0y;
    sx = Math.max(-maxShift, Math.min(maxShift, dx * 0.12));
    sy = Math.max(-maxShift, Math.min(maxShift, dy * 0.12));
    apply();
  }

  function onUp(e){
    down = false;
    sx = 0; sy = 0;
    apply();
  }

  stage.addEventListener('pointerdown', onDown, { passive:true });
  stage.addEventListener('pointermove', onMove, { passive:true });
  stage.addEventListener('pointerup', onUp, { passive:true });
  stage.addEventListener('pointercancel', onUp, { passive:true });

  return () => {
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
  };
}
