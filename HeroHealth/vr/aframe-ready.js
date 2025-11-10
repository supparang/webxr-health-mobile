// === /HeroHealth/vr/aframe-ready.js ===
// รอจน AFRAME.THREE พร้อม แล้วค่อย resolve
export function waitAframe() {
  if (globalThis.AFRAME?.THREE) {
    globalThis.THREE = globalThis.AFRAME.THREE;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      if (globalThis.AFRAME?.THREE) {
        try { globalThis.THREE = globalThis.AFRAME.THREE; } catch {}
        clearInterval(iv);
        resolve();
      }
    };
    const iv = setInterval(done, 40);
    // เผื่อ scene ยิง loaded เร็ว
    globalThis.addEventListener?.('hha:aframe-ready', done, { once: true });
    document.addEventListener('DOMContentLoaded', () => {
      const sc = document.getElementById('scene');
      if (sc) sc.addEventListener('loaded', done, { once: true });
    });
  });
}
