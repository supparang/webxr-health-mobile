// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch/Gyro world-shift for DOM VR feel (GoodJunkVR)
// ✅ Named export: attachTouchLook (fix import error)
// ✅ DOES NOT block clicking targets (.gj-target) or HUD/buttons
// ✅ Emits window event: hha:shift {x,y} for hazard/minis
// ✅ Drag-to-shift (default on). Gyro optional.

'use strict';

export function attachTouchLook(opts = {}) {
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  const ringEl  = opts.ringEl  || document.getElementById('atk-ring');
  const laserEl = opts.laserEl || document.getElementById('atk-laser');

  const maxShiftPx = Number(opts.maxShiftPx ?? 170);
  const ease = clamp(Number(opts.ease ?? 0.12), 0.02, 0.35);

  // default: drag enabled, gyro disabled (กัน "โลกไหลเอง")
  const enableDrag = (opts.drag !== false);
  const enableGyro = (opts.gyro === true);

  // For aiming reference (optional; engine uses its own aim anyway)
  const aimY = clamp(Number(opts.aimY ?? 0.62), 0.1, 0.95);

  if (!layerEl) {
    console.warn('[touch-look] layerEl missing');
    return { detach(){} };
  }

  const state = {
    dragging:false,
    lastX:0, lastY:0,

    // target shift
    tx:0, ty:0,

    // current applied shift
    x:0, y:0,

    // gyro target add-on
    gx:0, gy:0,

    raf:0,
    bound:false
  };

  function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function shouldIgnorePointer(ev){
    const t = ev.target;
    if (!t) return false;

    // IMPORTANT: do NOT intercept clicks on targets, HUD, controls
    if (t.closest && t.closest('.gj-target')) return true;
    if (t.closest && t.closest('.hha-hud')) return true;
    if (t.closest && t.closest('.hha-controls')) return true;
    if (t.closest && t.closest('button, a, input, textarea, select')) return true;

    return false;
  }

  function onDown(ev){
    if (!enableDrag) return;
    if (shouldIgnorePointer(ev)) return;

    state.dragging = true;
    state.lastX = ev.clientX;
    state.lastY = ev.clientY;
  }

  function onMove(ev){
    if (!enableDrag) return;
    if (!state.dragging) return;

    const dx = (ev.clientX - state.lastX);
    const dy = (ev.clientY - state.lastY);
    state.lastX = ev.clientX;
    state.lastY = ev.clientY;

    // scale drag -> shift
    state.tx = clamp(state.tx + dx * 0.35, -maxShiftPx, maxShiftPx);
    state.ty = clamp(state.ty + dy * 0.35, -maxShiftPx, maxShiftPx);
  }

  function onUp(){
    if (!enableDrag) return;
    state.dragging = false;
  }

  function onGyro(ev){
    if (!enableGyro) return;
    // gamma: left/right, beta: front/back
    const gamma = Number(ev.gamma)||0;
    const beta  = Number(ev.beta)||0;

    // map gyro to gentle shift (subtle, not auto-drift too much)
    state.gx = clamp(gamma * 1.4, -maxShiftPx, maxShiftPx);
    state.gy = clamp((beta - 20) * 0.8, -maxShiftPx, maxShiftPx);
  }

  function apply(){
    // ease to target+gyro
    const targetX = clamp(state.tx + state.gx, -maxShiftPx, maxShiftPx);
    const targetY = clamp(state.ty + state.gy, -maxShiftPx, maxShiftPx);

    state.x = state.x + (targetX - state.x) * ease;
    state.y = state.y + (targetY - state.y) * ease;

    // apply ONLY to world layers (targets + hazards), not HUD
    const tr = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0px)`;
    layerEl.style.transform = tr;

    if (ringEl)  ringEl.style.transform  = tr;
    if (laserEl) laserEl.style.transform = tr;

    // tell engine/hazards (dodge detection)
    try{
      window.dispatchEvent(new CustomEvent('hha:shift', { detail: { x: state.x, y: state.y, aimY } }));
    }catch(_){}

    state.raf = requestAnimationFrame(apply);
  }

  function bind(){
    if (state.bound) return;
    state.bound = true;

    // use window events so it works even if layer doesn't cover whole screen
    window.addEventListener('pointerdown', onDown, { passive:true });
    window.addEventListener('pointermove', onMove, { passive:true });
    window.addEventListener('pointerup', onUp, { passive:true });
    window.addEventListener('pointercancel', onUp, { passive:true });

    if (enableGyro){
      window.addEventListener('deviceorientation', onGyro, { passive:true });
    }

    state.raf = requestAnimationFrame(apply);
  }

  function detach(){
    try{ cancelAnimationFrame(state.raf); }catch(_){}
    state.raf = 0;

    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('deviceorientation', onGyro);

    // reset transforms
    try{ layerEl.style.transform=''; }catch(_){}
    try{ if (ringEl) ringEl.style.transform=''; }catch(_){}
    try{ if (laserEl) laserEl.style.transform=''; }catch(_){}
  }

  bind();
  return { detach };
}

export default attachTouchLook;