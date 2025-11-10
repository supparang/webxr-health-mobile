// === /HeroHealth/vr/three-safe.js ===
export function waitAframe() {
  if (globalThis.AFRAME?.THREE) {
    try { globalThis.THREE = globalThis.AFRAME.THREE; } catch {}
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const tryMap = () => {
      if (globalThis.AFRAME?.THREE) {
        try { globalThis.THREE = globalThis.AFRAME.THREE; } catch {}
        clearInterval(iv);
        resolve();
      }
    };
    const iv = setInterval(tryMap, 40);
    document.addEventListener('DOMContentLoaded', () => {
      const sc = document.getElementById('scene');
      if (sc) sc.addEventListener('loaded', tryMap, { once: true });
    });
    globalThis.addEventListener?.('hha:aframe-ready', tryMap, { once: true });
  });
}

export function worldPosOf(el){
  const T = (globalThis.AFRAME && globalThis.AFRAME.THREE) || globalThis.THREE;
  if (T && el?.object3D?.getWorldPosition) {
    return el.object3D.getWorldPosition(new T.Vector3());
  }
  const p = el?.getAttribute?.('position') || {x:0,y:0,z:-1.6};
  return { x:+p.x||0, y:+p.y||0, z:+p.z||-1.6 };
}
export default { waitAframe, worldPosOf };
