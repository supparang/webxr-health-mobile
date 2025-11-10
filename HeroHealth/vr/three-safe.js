// === three-safe.js ===
export function waitAframe() {
  if (globalThis.AFRAME?.THREE) {
    try { globalThis.THREE = globalThis.AFRAME.THREE; } catch {}
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
    globalThis.addEventListener?.('hha:aframe-ready', done, { once: true });
    document.addEventListener('DOMContentLoaded', () => {
      const sc = document.getElementById('scene');
      if (sc) sc.addEventListener('loaded', done, { once: true });
    });
  });
}
export default { waitAframe };