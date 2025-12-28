/* === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
FIX: allow mouse click on targets
- world shift starts ONLY when dragging empty stage (not on .gj-target / buttons / HUD / overlays)
- NO setPointerCapture (prevents stealing click)
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

  // Drag threshold: click != drag
  const DRAG_THRESHOLD_PX = Number(opts.dragThresholdPx ?? 6);
  let moved = false;

  function apply() {
    vx = lerp(vx, tx, 0.18);
    vy = lerp(vy, ty, 0.18);
    stage.style.transform = `translate3d(${vx.toFixed(2)}px, ${vy.toFixed(2)}px, 0)`;
  }

  function isInteractiveTarget(el){
    if (!el || !el.closest) return false;
    return !!el.closest(
      '.gj-target,' +                 // targets
      '#btnShoot,.btn-shoot,' +       // shoot button
      '#startOverlay,#btnStart,.start-overlay,' + // start UI
      '.hha-hud,.hha-controls,.hha-fever'         // HUD/controls
    );
  }

  function onDown(e) {
    // only left mouse / primary touch
    if (e.button != null && e.button !== 0) return;

    // IMPORTANT: if clicked on target/UI => do NOT start world shift
    if (isInteractiveTarget(e.target)) return;

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

    // snap back
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
