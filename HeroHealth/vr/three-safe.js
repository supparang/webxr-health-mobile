// === /HeroHealth/vr/three-safe.js (2025-11-10 release-safe) ===
// Utility: รอจนกว่า AFRAME.THREE จะพร้อม แล้วค่อยตั้ง global.THREE
// ใช้ในทุกโหมดก่อน import ที่ต้องใช้ THREE

export function waitAframe() {
  // 1️⃣ ถ้ามีอยู่แล้ว → resolve ทันที
  if (globalThis.AFRAME?.THREE) {
    if (!globalThis.THREE) globalThis.THREE = globalThis.AFRAME.THREE;
    return Promise.resolve();
  }

  // 2️⃣ ถ้ายังไม่มี → รอ event หรือ polling
  return new Promise((resolve) => {
    const tryResolve = () => {
      if (globalThis.AFRAME?.THREE) {
        if (!globalThis.THREE) globalThis.THREE = globalThis.AFRAME.THREE;
        clearInterval(iv);
        resolve();
      }
    };

    // Poll ทุก 50ms เผื่อโหลด A-Frame ช้า
    const iv = setInterval(tryResolve, 50);

    // ฟัง event ที่ scene ยิงเมื่อโหลดเสร็จ
    const doneOnce = () => tryResolve();
    document.addEventListener('DOMContentLoaded', () => {
      const sc = document.getElementById('scene');
      if (sc) sc.addEventListener('loaded', doneOnce, { once: true });
    });

    // เพิ่ม event เฉพาะระบบ HeroHealth ที่จะ trigger เอง
    globalThis.addEventListener?.('hha:aframe-ready', doneOnce, { once: true });
  });
}

// ✅ สำหรับใช้งานสะดวก (await global.THREE ให้พร้อม)
export async function ensureThree() {
  await waitAframe();
  return globalThis.THREE;
}

export default { waitAframe, ensureThree };