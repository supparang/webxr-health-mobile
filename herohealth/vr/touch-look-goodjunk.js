// === /herohealth/vr/touch-look-hha.js ===
// HHA Touch-Look (DOM pan) + Auto-Pan Assist receiver
// - Drag to pan (mobile/pc)
// - Listen to hha:pan_suggest and nudge view gently (no fighting user)
// - Works by adding translation on top of current computed transform (matrix/matrix3d/translate*)
// - Safe clamps and cooldown

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

function nowMs(){
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

// Parse computed transform into DOMMatrix (matrix or matrix3d)
function readMatrix(el){
  try{
    if (!el || !ROOT.getComputedStyle) return null;
    const tr = ROOT.getComputedStyle(el).transform;
    if (!tr || tr === 'none') return new DOMMatrix();
    return new DOMMatrix(tr);
  }catch{
    return null;
  }
}

function writeMatrix(el, m){
  if (!el || !m) return false;
  try{
    // keep as matrix3d for robustness
    el.style.transform = `matrix3d(${[
      m.m11, m.m12, m.m13, m.m14,
      m.m21, m.m22, m.m23, m.m24,
      m.m31, m.m32, m.m33, m.m34,
      m.m41, m.m42, m.m43, m.m44
    ].map(n=>Number(n).toFixed(6)).join(',')})`;
    return true;
  }catch{
    return false;
  }
}

function getRect(el){
  try{ return el.getBoundingClientRect(); }catch{ return null; }
}

export function attachTouchLook(opts = {}){
  if (!DOC) return { destroy(){} };

  const {
    // element that we apply transform to (playfield / spawn host)
    moveHost   = '#hvr-layer',
    // bounds reference (usually viewport / wrapper)
    boundsHost = null,

    // drag
    enabled = true,
    dragSpeed = 1.0,

    // clamp (ratio of bounds)
    clampRatio = 0.40,

    // auto-pan receiver
    allowAutoPan = true,
    autoPanMode = 'priority',   // 'bad' | 'priority' | 'any'
    autoPanCooldownMs = 900,
    autoPanMaxStep = 18,        // px per tick
    autoPanEase = 0.12,         // 0..1
    autoPanDeadZone = 0.10      // 0..1 (vector magnitude threshold)
  } = opts || {};

  const host =
    (typeof moveHost === 'string') ? DOC.querySelector(moveHost) :
    (moveHost && moveHost.nodeType === 1) ? moveHost : null;

  if (!host) {
    console.warn('[touch-look-hha] moveHost not found:', moveHost);
    return { destroy(){} };
  }

  const bounds =
    boundsHost
      ? ((typeof boundsHost === 'string') ? DOC.querySelector(boundsHost) : boundsHost)
      : (host.parentElement || DOC.body);

  let alive = true;

  // current translation offsets (we apply to computed matrix translation)
  let tx = 0, ty = 0;

  // drag state
  let dragging = false;
  let lastX = 0, lastY = 0;

  // cooldown (user input vs auto-pan)
  let lastUserInputAt = 0;

  // small integrator for auto-pan
  let apVx = 0, apVy = 0, apI = 0, apKind = 'good';

  function markUser(){
    lastUserInputAt = nowMs();
  }

  function boundsLimits(){
    const br = getRect(bounds) || { width: (ROOT.innerWidth||1), height:(ROOT.innerHeight||1) };
    const limX = br.width  * clamp(clampRatio, 0.12, 0.60);
    const limY = br.height * clamp(clampRatio, 0.12, 0.60);
    return { limX, limY };
  }

  function apply(){
    // apply (tx,ty) by adding to current computed transform translation
    const m = readMatrix(host);
    if (!m) return;

    const { limX, limY } = boundsLimits();
    const nx = clamp(tx, -limX, limX);
    const ny = clamp(ty, -limY, limY);
    tx = nx; ty = ny;

    // IMPORTANT: we add our (tx,ty) to "base" matrix translation each time from a stored base
    // To avoid drift when other code writes transform, we keep base matrix snapshot once.
  }

  // base matrix snapshot (so we don't accumulate over already-added tx/ty)
  let baseM = readMatrix(host) || new DOMMatrix();

  function resetBase(){
    baseM = readMatrix(host) || new DOMMatrix();
  }

  function render(){
    if (!alive) return;
    const { limX, limY } = boundsLimits();

    // compose base + (tx,ty)
    const m = baseM ? baseM.clone() : (readMatrix(host) || new DOMMatrix());
    m.m41 = (baseM ? baseM.m41 : 0) + clamp(tx, -limX, limX);
    m.m42 = (baseM ? baseM.m42 : 0) + clamp(ty, -limY, limY);

    writeMatrix(host, m);
  }

  // --- Drag handlers ---
  function onDown(ev){
    if (!enabled) return;
    dragging = true;
    markUser();

    const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    lastX = p.clientX || 0;
    lastY = p.clientY || 0;

    // when user starts dragging, treat current transform as new base
    resetBase();
    // keep our tx/ty as-is
  }

  function onMove(ev){
    if (!enabled) return;
    if (!dragging) return;

    const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const x = p.clientX || 0;
    const y = p.clientY || 0;

    const dx = (x - lastX) * dragSpeed;
    const dy = (y - lastY) * dragSpeed;

    lastX = x; lastY = y;

    tx += dx;
    ty += dy;

    markUser();
    try{ ev.preventDefault(); }catch{}
    render();
  }

  function onUp(){
    if (!enabled) return;
    if (!dragging) return;
    dragging = false;
    markUser();
    // refresh base so other scripts can safely modify after drag
    resetBase();
    render();
  }

  // If other code overwrites transform, we want to re-sync base sometimes
  function onResize(){
    resetBase();
    render();
  }

  // --- Auto-pan receiver ---
  function shouldAuto(){
    if (!allowAutoPan) return false;
    const t = nowMs();
    if (t - lastUserInputAt < autoPanCooldownMs) return false;
    if (dragging) return false;
    return true;
  }

  function onPanSuggest(ev){
    if (!allowAutoPan || !ev || !ev.detail) return;

    const { vx, vy, kind, intensity } = ev.detail;

    const mag = Math.sqrt((vx||0)*(vx||0) + (vy||0)*(vy||0));
    if (mag < autoPanDeadZone) return;

    apVx = (vx||0) / mag;
    apVy = (vy||0) / mag;
    apI  = clamp(intensity ?? 0.6, 0, 1);
    apKind = String(kind || 'good');

    // obey mode
    if (autoPanMode === 'bad' && apKind !== 'bad') return;

    // do nothing instantly; we nudge in RAF loop
  }

  let raf = null;
  function tick(){
    if (!alive) return;

    if (shouldAuto()){
      // We want to bring target toward center => move content opposite to direction
      const wantX = -apVx;
      const wantY = -apVy;

      const step = clamp(autoPanMaxStep * (0.30 + apI * 0.95) * autoPanEase, 1.2, autoPanMaxStep);

      // if no current suggestion, decay
      const has = (Math.abs(apVx) + Math.abs(apVy)) > 0.01;

      if (has){
        tx += wantX * step;
        ty += wantY * step;

        // gentle decay so it stops when target comes in
        apVx *= 0.92;
        apVy *= 0.92;
        apI  *= 0.94;

        render();
      } else {
        apI *= 0.92;
      }
    }

    raf = ROOT.requestAnimationFrame(tick);
  }

  // --- Bind events ---
  // mark user inputs widely
  try{
    ROOT.addEventListener('wheel', markUser, { passive:true });
    ROOT.addEventListener('keydown', markUser, { passive:true });
    ROOT.addEventListener('scroll', markUser, { passive:true });
  }catch{}

  // pointer/touch bind on bounds (so drag anywhere works)
  const targetEl = bounds || host;

  try{
    targetEl.addEventListener('pointerdown', onDown, { passive:true });
    targetEl.addEventListener('pointermove', onMove, { passive:false });
    targetEl.addEventListener('pointerup', onUp, { passive:true });
    targetEl.addEventListener('pointercancel', onUp, { passive:true });

    targetEl.addEventListener('touchstart', onDown, { passive:true });
    targetEl.addEventListener('touchmove', onMove, { passive:false });
    targetEl.addEventListener('touchend', onUp, { passive:true });
    targetEl.addEventListener('touchcancel', onUp, { passive:true });
  }catch{}

  // receive pan suggest
  try{
    ROOT.addEventListener('hha:pan_suggest', onPanSuggest);
  }catch{}

  // resize sync
  try{
    ROOT.addEventListener('resize', onResize, { passive:true });
  }catch{}

  // init
  resetBase();
  render();
  raf = ROOT.requestAnimationFrame(tick);

  return {
    destroy(){
      alive = false;
      try{ if (raf) ROOT.cancelAnimationFrame(raf); }catch{}
      raf = null;

      try{
        targetEl.removeEventListener('pointerdown', onDown);
        targetEl.removeEventListener('pointermove', onMove);
        targetEl.removeEventListener('pointerup', onUp);
        targetEl.removeEventListener('pointercancel', onUp);

        targetEl.removeEventListener('touchstart', onDown);
        targetEl.removeEventListener('touchmove', onMove);
        targetEl.removeEventListener('touchend', onUp);
        targetEl.removeEventListener('touchcancel', onUp);
      }catch{}

      try{
        ROOT.removeEventListener('hha:pan_suggest', onPanSuggest);
        ROOT.removeEventListener('resize', onResize);
        ROOT.removeEventListener('wheel', markUser);
        ROOT.removeEventListener('keydown', markUser);
        ROOT.removeEventListener('scroll', markUser);
      }catch{}
    }
  };
}

export default { attachTouchLook };