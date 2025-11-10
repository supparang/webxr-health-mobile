// === vr/aframe-ready.js ===
export function waitAframe() {
  if (globalThis.AFRAME?.THREE) {
    globalThis.THREE = globalThis.AFRAME.THREE;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (globalThis.AFRAME?.THREE) {
        clearInterval(iv);
        globalThis.THREE = globalThis.AFRAME.THREE;
        resolve();
      }
    }, 40);
    document.addEventListener("DOMContentLoaded", () => {
      const sc = document.querySelector("a-scene");
      sc && sc.addEventListener("loaded", () => {
        if (globalThis.AFRAME?.THREE) {
          clearInterval(iv);
          globalThis.THREE = globalThis.AFRAME.THREE;
          resolve();
        }
      });
    });
  });
}
