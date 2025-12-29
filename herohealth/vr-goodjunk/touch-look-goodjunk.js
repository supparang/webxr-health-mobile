// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function isIOS(){
  const ua = String(navigator.userAgent||'');
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
async function requestIOSPermission(){
  try{
    const DO = ROOT.DeviceOrientationEvent;
    if (!DO || typeof DO.requestPermission !== 'function') return true;
    const res = await DO.requestPermission();
    return res === 'granted';
  }catch(_){ return false; }
}

export function attachTouchLook(opts = {}){
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  if (!layerEl){
    console.warn('[touch-look] missing layerEl');
    return { destroy(){}, setEnabled(){} };
  }

  const maxShiftPx = clamp(opts.maxShiftPx ?? 170, 40, 360);
  const ease = clamp(opts.ease ?? 0.12, 0.02, 0.40);

  const gyroScale = clamp(opts.gyroScale ?? 1.0, 0.2, 2.2);
  const gyroMax = clamp(opts.gyroMax ?? (maxShiftPx * 0.70), 20, maxShiftPx);

  let enabled = true;

  let tx = 0, ty = 0;
  let dragX = 0, dragY = 0;
  let gyroX = 0, gyroY = 0;

  let dragging = false;
  let sx = 0, sy = 0;
  let bx = 0, by = 0;

  let gyroAllowed = !isIOS();
  let gyroBound = false;

  function apply(){
    const dx = clamp(dragX + gyroX, -maxShiftPx, maxShiftPx);
    const dy = clamp(dragY + gyroY, -maxShiftPx, maxShiftPx);

    tx += (dx - tx) * ease;
    ty += (dy - ty) * ease;

    layerEl.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
    if (enabled) ROOT.requestAnimationFrame(apply);
  }

  function onPointerDown(e){
    if (!enabled) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    bx = dragX; by = dragY;

    if (!gyroAllowed && isIOS()){
      requestIOSPermission().then(ok => {
        gyroAllowed = ok;
        if (ok && !gyroBound) bindGyro();
      });
    }
  }
  function onPointerMove(e){
    if (!enabled || !dragging) return;
    const ddx = (e.clientX - sx);
    const ddy = (e.clientY - sy);
    dragX = clamp(bx + (-ddx), -maxShiftPx, maxShiftPx);
    dragY = clamp(by + (-ddy), -maxShiftPx, maxShiftPx);
  }
  function onPointerUp(){ dragging = false; }

  function onDeviceOrientation(ev){
    if (!enabled || !gyroAllowed) return;
    const g = Number(ev.gamma);
    const b = Number(ev.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    const gx = clamp((-g / 30) * gyroMax * gyroScale, -gyroMax, gyroMax);
    const gy = clamp((-(b - 10) / 40) * gyroMax * gyroScale, -gyroMax, gyroMax);

    gyroX += (gx - gyroX) * 0.16;
    gyroY += (gy - gyroY) * 0.16;
  }

  function bindGyro(){
    if (gyroBound) return;
    gyroBound = true;
    ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
  }

  const stage = document.getElementById('gj-stage') || layerEl;
  stage.style.touchAction = 'none';

  stage.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  if (!isIOS()) bindGyro();

  ROOT.requestAnimationFrame(apply);

  return {
    destroy(){
      try{ stage.removeEventListener('pointerdown', onPointerDown); }catch(_){}
      try{ ROOT.removeEventListener('pointermove', onPointerMove); }catch(_){}
      try{ ROOT.removeEventListener('pointerup', onPointerUp); }catch(_){}
      try{ ROOT.removeEventListener('pointercancel', onPointerUp); }catch(_){}
      try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation); }catch(_){}
      enabled = false;
    },
    setEnabled(v){
      enabled = !!v;
      if (enabled) ROOT.requestAnimationFrame(apply);
    }
  };
}