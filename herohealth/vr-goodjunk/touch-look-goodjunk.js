// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch/Gyro Look — moves only the DOM layer (VR-feel) + exports attachTouchLook
// ✅ export attachTouchLook
// ✅ drag look on desktop/mobile
// ✅ deviceorientation (best effort) on mobile
// ✅ applies translate3d to layerEl
// ✅ keeps crosshair fixed (aim point)

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function isCoarse(){
  try{ return matchMedia('(pointer: coarse)').matches; }catch(_){ return false; }
}

function getClientXY(ev){
  if (!ev) return { x:0, y:0 };
  if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  if (ev.changedTouches && ev.changedTouches[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
  return { x: ev.clientX ?? 0, y: ev.clientY ?? 0 };
}

export function attachTouchLook(opts = {}){
  const layerEl = opts.layerEl;
  const crosshairEl = opts.crosshairEl;
  const maxShiftPx = clamp(opts.maxShiftPx ?? 170, 40, 420);
  const ease = clamp(opts.ease ?? 0.12, 0.02, 0.35);
  const aimY = clamp(opts.aimY ?? 0.62, 0.35, 0.80);

  if (!layerEl){
    return {
      setShift(){},
      destroy(){},
      getShift(){ return { x:0, y:0 }; }
    };
  }

  let dragging = false;
  let startX = 0, startY = 0;
  let baseX = 0, baseY = 0;

  let tx = 0, ty = 0; // target shift
  let sx = 0, sy = 0; // smoothed shift

  // gyro
  let useGyro = false;
  let gyroX = 0, gyroY = 0;
  let gyroRef = null;

  function apply(){
    sx += (tx - sx) * ease;
    sy += (ty - sy) * ease;
    layerEl.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0)`;
    layerEl.style.willChange = 'transform';
    raf = requestAnimationFrame(apply);
  }
  let raf = requestAnimationFrame(apply);

  function setShift(x, y){
    tx = clamp(x, -maxShiftPx, maxShiftPx);
    ty = clamp(y, -maxShiftPx, maxShiftPx);
  }

  function getShift(){ return { x: sx, y: sy }; }

  function onDown(ev){
    // don't steal clicks on targets
    const t = ev.target;
    if (t && t.classList && t.classList.contains('gj-target')) return;

    dragging = true;
    const p = getClientXY(ev);
    startX = p.x; startY = p.y;
    baseX = tx; baseY = ty;

    try{ ev.preventDefault?.(); }catch(_){}
  }
  function onMove(ev){
    if (!dragging) return;
    const p = getClientXY(ev);

    // horizontal and vertical drag -> shift
    const dx = (p.x - startX);
    const dy = (p.y - startY);

    // invert y slightly to feel like looking
    const nx = baseX + dx * 0.55;
    const ny = baseY + dy * 0.45;

    setShift(nx, ny);

    try{ ev.preventDefault?.(); }catch(_){}
  }
  function onUp(){
    dragging = false;
  }

  // best-effort gyro (mobile)
  function onOri(ev){
    if (!useGyro) return;
    const beta = Number(ev.beta)||0;  // front/back
    const gamma = Number(ev.gamma)||0; // left/right

    if (!gyroRef){
      gyroRef = { beta, gamma };
      return;
    }
    // delta from ref
    const db = beta - gyroRef.beta;
    const dg = gamma - gyroRef.gamma;

    // map to pixels
    gyroX = clamp(dg * (maxShiftPx/18), -maxShiftPx, maxShiftPx);
    gyroY = clamp(db * (maxShiftPx/22), -maxShiftPx, maxShiftPx);

    // blend with current drag if not dragging
    if (!dragging){
      setShift(gyroX, gyroY);
    }
  }

  // bind
  const target = window;
  target.addEventListener('pointerdown', onDown, { passive:false });
  target.addEventListener('pointermove', onMove, { passive:false });
  target.addEventListener('pointerup', onUp, { passive:true });
  target.addEventListener('pointercancel', onUp, { passive:true });

  // enable gyro on mobile-like devices (best effort)
  // NOTE: Permission UI handled by A-Frame’s device-orientation-permission-ui in HTML
  useGyro = isCoarse();
  window.addEventListener('deviceorientation', onOri, { passive:true });

  // place crosshair visually via CSS variable (optional)
  try{
    if (crosshairEl){
      crosshairEl.style.top = `${Math.round(aimY*100)}%`;
    }
  }catch(_){}

  return {
    setShift,
    getShift,
    destroy(){
      try{ cancelAnimationFrame(raf); }catch(_){}
      try{
        target.removeEventListener('pointerdown', onDown);
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
        window.removeEventListener('deviceorientation', onOri);
      }catch(_){}
    }
  };
}