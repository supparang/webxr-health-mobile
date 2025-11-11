// รอจน AFRAME.THREE พร้อม แล้วค่อย resolve และ map ไปยัง window.THREE
export function waitAframe() {
  if (globalThis.AFRAME && globalThis.AFRAME.THREE) {
    try { globalThis.THREE = globalThis.AFRAME.THREE; } catch {}
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      if (globalThis.AFRAME && globalThis.AFRAME.THREE) {
        try { globalThis.THREE = globalThis.AFRAME.THREE; } catch {}
        clearInterval(iv);
        resolve();
      }
    };
    const iv = setInterval(done, 40);
    // scene.loaded ก็ถือว่าพร้อม
    document.addEventListener('DOMContentLoaded', () => {
      const sc = document.getElementById('scene');
      if (sc) sc.addEventListener('loaded', done, { once: true });
    });
    // เผื่อส่วนอื่นยิงสัญญาณเอง
    if (globalThis.addEventListener) {
      globalThis.addEventListener('hha:aframe-ready', done, { once: true });
    }
  });
}
export default { waitAframe };