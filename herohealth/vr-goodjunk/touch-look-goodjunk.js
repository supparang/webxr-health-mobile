// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch/gyro "world shift" for GoodJunkVR
// ✅ ESM export attachTouchLook (fixes: does not provide export named attachTouchLook)
// ✅ Mouse: shift only while dragging (prevents targets moving when just moving mouse)
// ✅ Touch: drag-to-shift
// ✅ Optional gyro drift for mobile (subtle)
// Returns { recenter(), getShift(), destroy() }

'use strict';

export function attachTouchLook(opts = {}){
  const crosshairEl = opts.crosshairEl || null;
  const layerEl = opts.layerEl || null;
  const stageEl = opts.stageEl || null;
  const view = String(opts.view || 'pc').toLowerCase();

  const aimY = Number.isFinite(opts.aimY) ? opts.aimY : 0.62;
  const maxShiftPx = Number.isFinite(opts.maxShiftPx) ? opts.maxShiftPx : 160;
  const ease = Number.isFinite(opts.ease) ? opts.ease : 0.12;

  if (!layerEl) return { recenter(){}, getShift(){ return {x:0,y:0}; }, destroy(){} };

  const doc = document;
  const root = window;

  const state = {
    x:0, y:0,
    tx:0, ty:0,
    dragging:false,
    px:0, py:0,
    isFinePointer: matchMedia('(pointer:fine)').matches,
    destroyed:false,
    gyroOn: (view === 'mobile'), // เปิด gyro เฉพาะ mobile โดย default
    lastOriAt: 0
  };

  function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function apply(){
    // world shift: move LAYER (targets) relative to fixed crosshair
    state.x += (state.tx - state.x) * ease;
    state.y += (state.ty - state.y) * ease;
    layerEl.style.transform = `translate(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px)`;
  }

  let raf = 0;
  function tick(){
    if (state.destroyed) return;
    apply();
    raf = root.requestAnimationFrame(tick);
  }
  raf = root.requestAnimationFrame(tick);

  function recenter(){
    state.tx = 0; state.ty = 0;
  }

  function onDown(e){
    // Mouse: allow drag-shift (but NOT move-shift)
    // Touch: drag-shift as usual
    state.dragging = true;
    state.px = e.clientX;
    state.py = e.clientY;
  }

  function onMove(e){
    if (!state.dragging) return;

    const dx = e.clientX - state.px;
    const dy = e.clientY - state.py;
    state.px = e.clientX;
    state.py = e.clientY;

    // scale feel
    const k = (view === 'mobile') ? 0.55 : 0.42;

    state.tx = clamp(state.tx + dx * k, -maxShiftPx, maxShiftPx);
    state.ty = clamp(state.ty + dy * k, -maxShiftPx, maxShiftPx);
  }

  function onUp(){
    state.dragging = false;
  }

  function onOri(ev){
    if (!state.gyroOn) return;
    const t = (performance && performance.now) ? performance.now() : Date.now();
    if (t - state.lastOriAt < 33) return; // ~30fps
    state.lastOriAt = t;

    const gamma = Number(ev.gamma)||0; // left-right
    const beta  = Number(ev.beta)||0;  // front-back

    // subtle drift
    const gx = clamp(gamma, -30, 30) / 30; // -1..1
    const gy = clamp(beta - 20, -40, 40) / 40;

    state.tx = clamp(state.tx + gx * 2.6, -maxShiftPx, maxShiftPx);
    state.ty = clamp(state.ty + gy * 1.6, -maxShiftPx, maxShiftPx);
  }

  // Important: don't let "mouse move" shift world unless dragging
  const moveTarget = root;
  layerEl.addEventListener('pointerdown', onDown, { passive:true });
  moveTarget.addEventListener('pointermove', onMove, { passive:true });
  moveTarget.addEventListener('pointerup', onUp, { passive:true });
  moveTarget.addEventListener('pointercancel', onUp, { passive:true });

  // Optional: double tap/click crosshair to recenter
  function onDbl(){
    recenter();
  }
  if (crosshairEl) crosshairEl.addEventListener('dblclick', onDbl, { passive:true });

  // gyro only if enabled
  root.addEventListener('deviceorientation', onOri, { passive:true });

  return {
    recenter,
    getShift(){ return { x: state.x, y: state.y, tx: state.tx, ty: state.ty }; },
    destroy(){
      state.destroyed = true;
      try{ root.cancelAnimationFrame(raf); }catch(_){}
      try{ layerEl.removeEventListener('pointerdown', onDown); }catch(_){}
      try{ moveTarget.removeEventListener('pointermove', onMove); }catch(_){}
      try{ moveTarget.removeEventListener('pointerup', onUp); }catch(_){}
      try{ moveTarget.removeEventListener('pointercancel', onUp); }catch(_){}
      try{ root.removeEventListener('deviceorientation', onOri); }catch(_){}
      try{ if (crosshairEl) crosshairEl.removeEventListener('dblclick', onDbl); }catch(_){}
    }
  };
}