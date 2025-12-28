// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch+Gyro Look (GoodJunk) — ESM
// ✅ named export: attachTouchLook (แก้ error import)
// ✅ drag on desktop/mobile -> shift playfield
// ✅ deviceorientation (mobile) -> subtle shift
// ✅ stereo: apply to both eyes/layers/crosshair/ring/laser if provided

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

function isMobileLike(){
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

/**
 * @param {Object} opts
 * @param {HTMLElement} [opts.stageEl] optional
 * @param {HTMLElement} [opts.layerEl] required (left)
 * @param {HTMLElement} [opts.crosshairEl]
 * @param {HTMLElement} [opts.ringEl]
 * @param {HTMLElement} [opts.laserEl]
 * @param {HTMLElement} [opts.layerElR] optional (stereo right)
 * @param {HTMLElement} [opts.crosshairElR]
 * @param {HTMLElement} [opts.ringElR]
 * @param {HTMLElement} [opts.laserElR]
 * @param {number} [opts.maxShiftPx=170]
 * @param {number} [opts.ease=0.12]
 * @param {number} [opts.aimY=0.62] (0..1) for crosshair baseline; used only if element absent
 */
export function attachTouchLook(opts = {}){
  const DOC = ROOT.document;
  if (!DOC) return { destroy(){} };

  const layerEl = opts.layerEl || DOC.getElementById('gj-layer');
  if (!layerEl) return { destroy(){} };

  const stageEl = opts.stageEl || DOC.getElementById('gj-stage');

  const left = {
    layer: layerEl,
    cross: opts.crosshairEl || DOC.getElementById('gj-crosshair'),
    ring:  opts.ringEl || DOC.getElementById('atk-ring'),
    laser: opts.laserEl || DOC.getElementById('atk-laser'),
  };

  const right = {
    layer: opts.layerElR || DOC.getElementById('gj-layerR'),
    cross: opts.crosshairElR || DOC.getElementById('gj-crosshairR'),
    ring:  opts.ringElR || DOC.getElementById('atk-ringR'),
    laser: opts.laserElR || DOC.getElementById('atk-laserR'),
  };

  const useStereo = !!(right.layer && DOC.body.classList.contains('gj-stereo'));

  const maxShift = clamp(opts.maxShiftPx ?? 170, 60, 360);
  const ease = clamp(opts.ease ?? 0.12, 0.05, 0.35);

  let targetX = 0, targetY = 0;
  let curX = 0, curY = 0;

  let dragging = false;
  let lastX = 0, lastY = 0;

  // gyro baseline
  let hasGyro = false;
  let gyroZeroGamma = 0;
  let gyroZeroBeta = 0;

  function applyTo(el, x, y){
    if (!el) return;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function applyAll(){
    // layer shift gives the VR-feel
    applyTo(left.layer, curX, curY);
    applyTo(left.ring,  curX, curY);
    applyTo(left.laser, curX, curY);
    applyTo(left.cross, curX, curY);

    if (useStereo){
      applyTo(right.layer, curX, curY);
      applyTo(right.ring,  curX, curY);
      applyTo(right.laser, curX, curY);
      applyTo(right.cross, curX, curY);
    }
  }

  let raf = 0;
  function tick(){
    curX = lerp(curX, targetX, ease);
    curY = lerp(curY, targetY, ease);
    applyAll();
    raf = ROOT.requestAnimationFrame(tick);
  }
  raf = ROOT.requestAnimationFrame(tick);

  function setTargetFromDelta(dx, dy){
    targetX = clamp(targetX + dx, -maxShift, maxShift);
    targetY = clamp(targetY + dy, -maxShift, maxShift);
  }

  // ---------- Pointer drag ----------
  function onDown(e){
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMove(e){
    if (!dragging) return;
    const x = e.clientX, y = e.clientY;
    const dx = (x - lastX);
    const dy = (y - lastY);
    lastX = x; lastY = y;

    // scale for mobile
    const scale = isMobileLike() ? 0.85 : 1.0;
    setTargetFromDelta(dx * scale, dy * scale);
  }
  function onUp(){ dragging = false; }

  const dragHost = stageEl || DOC.body;
  dragHost.addEventListener('pointerdown', onDown, { passive:true });
  ROOT.addEventListener('pointermove', onMove, { passive:true });
  ROOT.addEventListener('pointerup', onUp, { passive:true });
  ROOT.addEventListener('pointercancel', onUp, { passive:true });

  // ---------- Gyro (mobile) ----------
  function onOri(ev){
    const gamma = Number(ev.gamma);
    const beta  = Number(ev.beta);
    if (!Number.isFinite(gamma) || !Number.isFinite(beta)) return;

    if (!hasGyro){
      hasGyro = true;
      gyroZeroGamma = gamma;
      gyroZeroBeta = beta;
    }

    // soft gyro contribution (don’t fight drag)
    const dg = clamp(gamma - gyroZeroGamma, -25, 25);
    const db = clamp(beta  - gyroZeroBeta,  -25, 25);

    const gx = (dg / 25) * (maxShift * 0.55);
    const gy = (db / 25) * (maxShift * 0.35);

    // blend gyro into target
    targetX = clamp(lerp(targetX, gx, 0.08), -maxShift, maxShift);
    targetY = clamp(lerp(targetY, gy, 0.08), -maxShift, maxShift);
  }

  // try attach gyro (safe)
  try{
    ROOT.addEventListener('deviceorientation', onOri, { passive:true });
  }catch(_){}

  function destroy(){
    try{ ROOT.cancelAnimationFrame(raf); }catch(_){}
    try{ dragHost.removeEventListener('pointerdown', onDown); }catch(_){}
    try{ ROOT.removeEventListener('pointermove', onMove); }catch(_){}
    try{ ROOT.removeEventListener('pointerup', onUp); }catch(_){}
    try{ ROOT.removeEventListener('pointercancel', onUp); }catch(_){}
    try{ ROOT.removeEventListener('deviceorientation', onOri); }catch(_){}
  }

  return { destroy };
}