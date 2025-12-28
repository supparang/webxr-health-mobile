// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// World-shift (dodge) controller for GoodJunkVR
// ✅ Mouse: shift only while holding left button (drag)
// ✅ Touch: shift while touching
// ✅ Exposes ROOT.__HHA_VIEW_SHIFT__ = {x,y,pxX,pxY} normalized [-1..1]

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }

export function attachTouchLook(opts = {}){
  const doc = ROOT.document;
  if (!doc) return { detach(){} };

  const stageId = String(opts.stageId || 'gj-stage');
  const stage = doc.getElementById(stageId);
  if (!stage) return { detach(){} };

  const maxShiftPx = clamp(opts.maxShiftPx ?? 46, 18, 110);
  const sens = clamp(opts.sensitivity ?? 0.22, 0.08, 0.8);

  let down = false;
  let lastX = 0, lastY = 0;
  let pxX = 0, pxY = 0;

  function publish(){
    const nx = clamp(pxX / maxShiftPx, -1, 1);
    const ny = clamp(pxY / maxShiftPx, -1, 1);
    ROOT.__HHA_VIEW_SHIFT__ = { x:nx, y:ny, pxX, pxY };
  }

  function apply(){
    stage.style.transform = `translate3d(${pxX.toFixed(1)}px, ${pxY.toFixed(1)}px, 0px)`;
    publish();
  }

  function onDown(e){
    // mouse must be left button
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = true;
    lastX = e.clientX || 0;
    lastY = e.clientY || 0;
    try{ stage.setPointerCapture && stage.setPointerCapture(e.pointerId); }catch(_){}
  }

  function onMove(e){
    if (!down) return;
    const x = e.clientX || 0;
    const y = e.clientY || 0;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x; lastY = y;

    pxX = clamp(pxX + dx * sens, -maxShiftPx, maxShiftPx);
    pxY = clamp(pxY + dy * sens, -maxShiftPx, maxShiftPx);

    apply();
  }

  function onUp(e){
    down = false;
    try{ stage.releasePointerCapture && stage.releasePointerCapture(e.pointerId); }catch(_){}
  }

  // init
  publish();
  stage.style.willChange = 'transform';
  stage.addEventListener('pointerdown', onDown, { passive:true });
  stage.addEventListener('pointermove', onMove, { passive:false });
  stage.addEventListener('pointerup', onUp, { passive:true });
  stage.addEventListener('pointercancel', onUp, { passive:true });

  return {
    getShift(){ return ROOT.__HHA_VIEW_SHIFT__ || {x:0,y:0,pxX:0,pxY:0}; },
    detach(){
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      try{ stage.style.transform = ''; }catch(_){}
      ROOT.__HHA_VIEW_SHIFT__ = { x:0,y:0,pxX:0,pxY:0 };
    }
  };
}
