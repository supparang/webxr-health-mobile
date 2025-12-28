// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// GoodJunk Touch/Look — PRODUCTION SAFE
// ✅ ไม่เลื่อนโลกตาม mousemove เฉย ๆ
// ✅ เลื่อนเฉพาะตอน "ลาก" (pointerdown+move)
// ✅ แตะ/คลิกโดนเป้า (.gj-target) จะไม่ไปเลื่อนโลก
// ✅ รองรับ gyro บนมือถือ (เปิด/ปิดได้)

export function attachTouchLook(opts = {}) {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const doc  = root.document;
  if (!doc) return { destroy(){} };

  const q = (() => {
    try{
      const u = new URL(root.location.href);
      const o = {};
      u.searchParams.forEach((v,k)=> o[k]=v);
      return o;
    }catch(_){ return {}; }
  })();

  // query toggles
  // look=0 -> ปิดทั้งหมด
  // mouseLook=0 -> ปิดเมาส์ลาก (desktop)
  // gyro=0 -> ปิดไจโร
  if (String(q.look ?? '1') === '0') return { destroy(){} };

  const enableMouseDrag = (String(q.mouseLook ?? (opts.enableMouseDrag ?? '1')) !== '0');
  const enableGyro      = (String(q.gyro ?? (opts.enableGyro ?? '1')) !== '0');

  const world =
    opts.worldEl ||
    doc.querySelector(opts.worldSelector || '#gj-world') ||
    doc.querySelector('#playfield') ||
    doc.querySelector('#gj-layer') ||  // fallback (แต่แนะนำให้มี #gj-world ครอบเป้า)
    doc.body;

  let offX = 0, offY = 0;
  const maxX = Number(opts.maxX ?? 120);
  const maxY = Number(opts.maxY ?? 80);

  let dragging = false;
  let p0x = 0, p0y = 0;
  let startX = 0, startY = 0;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function apply(){
    offX = clamp(offX, -maxX, maxX);
    offY = clamp(offY, -maxY, maxY);
    try{
      world.style.transform = `translate3d(${offX}px, ${offY}px, 0)`;
      world.style.willChange = 'transform';
    }catch(_){}
  }

  function isOnTarget(ev){
    const t = ev && ev.target;
    return !!(t && t.closest && t.closest('.gj-target'));
  }

  function onPointerDown(ev){
    if (!enableMouseDrag) return;
    if (isOnTarget(ev)) return;          // ✅ คลิกเป้า = ยิง ไม่ใช่เลื่อนโลก
    dragging = true;
    p0x = ev.clientX || 0;
    p0y = ev.clientY || 0;
    startX = offX; startY = offY;
  }

  function onPointerMove(ev){
    if (!enableMouseDrag) return;
    if (!dragging) return;               // ✅ ไม่ลาก = ไม่เลื่อนโลก
    const x = ev.clientX || 0;
    const y = ev.clientY || 0;
    offX = startX + (x - p0x);
    offY = startY + (y - p0y);
    apply();
  }

  function onPointerUp(){
    dragging = false;
  }

  // --- Gyro (มือถือ) ---
  let gyroX0 = null, gyroY0 = null;
  function onDeviceOri(ev){
    if (!enableGyro) return;
    if (!ev) return;

    // gamma: ซ้าย-ขวา, beta: หน้า-หลัง
    const g = Number(ev.gamma);
    const b = Number(ev.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    if (gyroX0 == null){ gyroX0 = g; gyroY0 = b; }

    const dx = (g - gyroX0);
    const dy = (b - gyroY0);

    // scale ให้นุ่ม ๆ
    offX = clamp(dx * 2.2, -maxX, maxX);
    offY = clamp(dy * 1.4, -maxY, maxY);
    apply();
  }

  // bind
  doc.addEventListener('pointerdown', onPointerDown, { passive:true });
  doc.addEventListener('pointermove', onPointerMove, { passive:true });
  doc.addEventListener('pointerup', onPointerUp, { passive:true });
  doc.addEventListener('pointercancel', onPointerUp, { passive:true });

  if (enableGyro){
    root.addEventListener('deviceorientation', onDeviceOri, { passive:true });
  }

  // init
  apply();

  return {
    destroy(){
      doc.removeEventListener('pointerdown', onPointerDown);
      doc.removeEventListener('pointermove', onPointerMove);
      doc.removeEventListener('pointerup', onPointerUp);
      doc.removeEventListener('pointercancel', onPointerUp);
      root.removeEventListener('deviceorientation', onDeviceOri);
    }
  };
}
