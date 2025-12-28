/* === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
FIX: mouse click on targets must work
- world-shift starts ONLY when dragging empty stage
- no pointerCapture (prevents stealing click)
*/
'use strict';

export function attachTouchLook(opts = {}) {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const doc  = root.document;
  if (!doc) return () => {};

  const stage = doc.getElementById(opts.stageId || 'gj-stage') || doc.querySelector('#gj-stage') || doc.body;

  const maxShiftPx = Number(opts.maxShiftPx ?? 26);
  const lerp = (a,b,t)=> a + (b-a)*t;

  let isDown = false;
  let sx = 0, sy = 0;
  let tx = 0, ty = 0;
  let vx = 0, vy = 0;

  const DRAG_THRESHOLD_PX = Number(opts.dragThresholdPx ?? 6);
  let moved = false;

  function apply() {
    vx = lerp(vx, tx, 0.18);
    vy = lerp(vy, ty, 0.18);
    stage.style.transform = `translate3d(${vx.toFixed(2)}px, ${vy.toFixed(2)}px, 0)`;
  }

  function isInteractive(el){
    if (!el || !el.closest) return false;
    return !!el.closest(
      '.gj-target,' +
      '#gj-layer,' +
      '#btnShoot,.btn-shoot,' +
      '#startOverlay,#btnStart,.start-overlay,' +
      '.hha-hud,.hha-controls,.hha-fever'
    );
  }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    if (isInteractive(e.target)) return;

    isDown = true;
    moved = false;
    sx = e.clientX;
    sy = e.clientY;
  }

  function onMove(e) {
    if (!isDown) return;

    const dx = e.clientX - sx;
    const dy = e.clientY - sy;

    if (!moved){
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      moved = true;
    }

    tx = Math.max(-maxShiftPx, Math.min(maxShiftPx, dx * 0.08));
    ty = Math.max(-maxShiftPx, Math.min(maxShiftPx, dy * 0.08));
    apply();
  }

  function onUp() {
    if (!isDown) return;
    isDown = false;

    tx = 0; ty = 0;
    const t0 = performance.now();
    const dur = 180;

    function back(t) {
      const k = Math.min(1, (t - t0) / dur);
      vx = lerp(vx, 0, 0.22);
      vy = lerp(vy, 0, 0.22);
      stage.style.transform = `translate3d(${vx.toFixed(2)}px, ${vy.toFixed(2)}px, 0)`;
      if (k < 1) requestAnimationFrame(back);
      else stage.style.transform = 'translate3d(0,0,0)';
    }
    requestAnimationFrame(back);
  }

  stage.style.willChange = 'transform';

  stage.addEventListener('pointerdown', onDown, { passive:true });
  stage.addEventListener('pointermove', onMove, { passive:true });
  stage.addEventListener('pointerup', onUp, { passive:true });
  stage.addEventListener('pointercancel', onUp, { passive:true });
  stage.addEventListener('pointerleave', onUp, { passive:true });

  return function detach(){
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
    stage.removeEventListener('pointerleave', onUp);
    try{ stage.style.transform = 'translate3d(0,0,0)'; }catch(_){}
  };
}
