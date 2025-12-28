// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// GoodJunkVR — Touch/Mouse Look (World-Shift Dodge) — PRODUCTION
// ✅ Drag “พื้นว่าง” เพื่อเอียงโลก (targets + hazards ขยับ, crosshair ไม่ขยับ)
// ✅ ไม่รบกวนการคลิกยิงเป้า: ไม่เริ่ม drag ถ้ากดบน .gj-target/.target หรือปุ่ม/HUD
// ✅ ไม่ทำให้ “ขยับเมาส์แล้วโลกไหล” ถ้าไม่ได้ลากจริง
// ✅ Gyro (deviceorientation) เปิดเฉพาะ touch/coarse โดย default (บังคับด้วย ?gyro=1|0)
// ✅ API: attachTouchLook(opts) -> { recenter(), destroy(), getOffset(), setEnabled(bool) }

'use strict';

function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function clamp(v, a, b){
  v = Number(v); if (!Number.isFinite(v)) v = 0;
  return Math.max(a, Math.min(b, v));
}

function defaultShouldEnableGyro(){
  const g = String(qs('gyro','auto')).toLowerCase();
  if (g === '1' || g === 'true' || g === 'on') return true;
  if (g === '0' || g === 'false' || g === 'off') return false;

  // auto: enable only on touch / coarse pointer devices
  try{
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return !!(coarse || touch);
  }catch(_){
    return false;
  }
}

function isInteractiveEl(el){
  if (!el) return false;
  const sel = [
    'button','a','input','textarea','select',
    '.btn','.hud','.hha-hud','.hha-controls',
    '#btnShoot','#btnStart','#startOverlay',
    '#endOverlay','#btnRetry','#btnBackHub'
  ].join(',');
  return !!(el.closest && el.closest(sel));
}

function isTargetEl(el){
  if (!el) return false;
  const sel = [
    '.gj-target','.goodjunk-target','.target',
    '[data-target]','.pl-target','.gr-target'
  ].join(',');
  return !!(el.closest && el.closest(sel));
}

function safeStageEl(el){
  return (typeof el === 'string') ? document.querySelector(el) : el;
}

function applyTransform(els, x, y, z){
  const t = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z || 0}px)`;
  for (const e of els){
    if (!e) continue;
    e.style.transform = t;
  }
}

export function attachTouchLook(opts = {}){
  const stage = safeStageEl(opts.stage || '#gj-stage') || document.body;
  const layer = safeStageEl(opts.layer || '#gj-layer');
  const ring  = safeStageEl(opts.ring  || '#atk-ring');
  const laser = safeStageEl(opts.laser || '#atk-laser');

  // Which elements “move with the world”
  const shiftEls = Array.isArray(opts.shiftEls)
    ? opts.shiftEls.map(safeStageEl).filter(Boolean)
    : [layer, ring, laser].filter(Boolean);

  const maxShift = clamp(opts.maxShiftPx ?? 95, 40, 180);
  const gain = clamp(opts.gain ?? 0.24, 0.05, 0.65);       // drag sensitivity
  const gyroGain = clamp(opts.gyroGain ?? 0.055, 0.00, 0.20); // gyro drift sensitivity
  const friction = clamp(opts.friction ?? 0.86, 0.50, 0.98);  // inertia friction
  const spring = clamp(opts.spring ?? 0.18, 0.00, 0.40);      // return-to-center softness when idle
  const z = Number(opts.z ?? 0);

  let enabled = (opts.enabled !== false);
  let dragging = false;
  let px = 0, py = 0;        // offset
  let vx = 0, vy = 0;        // velocity (for smooth feel)
  let lastX = 0, lastY = 0;
  let raf = 0;
  let hasGyro = false;

  const enableGyro = (opts.enableGyro !== undefined) ? !!opts.enableGyro : defaultShouldEnableGyro();

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  function getOffset(){
    return { x: px, y: py, vx, vy, dragging, enabled };
  }

  function sync(){
    applyTransform(shiftEls, px, py, z);
    emit('hha:look', { x:px, y:py, vx, vy, dragging, enabled });
    if (typeof opts.onChange === 'function'){
      try{ opts.onChange(getOffset()); }catch(_){}
    }
  }

  function tick(){
    raf = 0;
    if (!enabled) return;

    // Smooth/inertia: velocity decays
    vx *= friction;
    vy *= friction;

    // If not dragging, ease back toward center a bit (soft recentre)
    if (!dragging){
      vx += (-px) * spring;
      vy += (-py) * spring;
    }

    // Integrate
    px = clamp(px + vx, -maxShift, maxShift);
    py = clamp(py + vy, -maxShift, maxShift);

    // Stop micro jitter
    if (!dragging && Math.abs(px) < 0.12 && Math.abs(py) < 0.12 && Math.abs(vx) < 0.12 && Math.abs(vy) < 0.12){
      px = 0; py = 0; vx = 0; vy = 0;
      sync();
      return;
    }

    sync();
    raf = requestAnimationFrame(tick);
  }

  function ensureRAF(){
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function beginDrag(e){
    if (!enabled) return;
    if (!e) return;

    // IMPORTANT: Only start drag on empty background (not targets, not UI)
    if (isTargetEl(e.target)) return;
    if (isInteractiveEl(e.target)) return;

    // Mouse: only left button / primary
    if (e.pointerType === 'mouse'){
      if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) return;
    }

    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    ensureRAF();
  }

  function moveDrag(e){
    if (!enabled) return;
    if (!dragging) return;
    if (!e) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // Drag changes velocity (feel “VR world shift”)
    vx += dx * gain;
    vy += dy * gain;

    // clamp velocity to avoid crazy jumps
    vx = clamp(vx, -20, 20);
    vy = clamp(vy, -20, 20);

    ensureRAF();
  }

  function endDrag(){
    dragging = false;
  }

  function recenter(hard = true){
    if (hard){
      px = 0; py = 0; vx = 0; vy = 0;
      sync();
      return;
    }
    // soft: just nudge toward center (spring will do the rest)
    vx += (-px) * 0.35;
    vy += (-py) * 0.35;
    ensureRAF();
  }

  function setEnabled(v){
    enabled = !!v;
    if (!enabled){
      dragging = false;
      px = 0; py = 0; vx = 0; vy = 0;
      if (raf){ cancelAnimationFrame(raf); raf = 0; }
      sync();
    } else {
      ensureRAF();
    }
  }

  // ---------- Bind pointers ----------
  const onPointerDown = (e)=>{ beginDrag(e); };
  const onPointerMove = (e)=>{ moveDrag(e); };
  const onPointerUp   = ()=>{ endDrag(); };

  stage.addEventListener('pointerdown', onPointerDown, { passive:true });
  window.addEventListener('pointermove', onPointerMove, { passive:true });
  window.addEventListener('pointerup', onPointerUp, { passive:true });
  window.addEventListener('pointercancel', onPointerUp, { passive:true });
  window.addEventListener('blur', onPointerUp, { passive:true });

  // Optional: double click/tap to recenter
  let lastTapAt = 0;
  stage.addEventListener('pointerup', (e)=>{
    if (!enabled) return;
    if (isTargetEl(e.target) || isInteractiveEl(e.target)) return;
    const t = Date.now();
    if (t - lastTapAt < 260){
      recenter(true);
    }
    lastTapAt = t;
  }, { passive:true });

  // ---------- Gyro drift (optional) ----------
  const onGyro = (ev)=>{
    if (!enabled) return;
    if (!enableGyro) return;

    // Ignore while dragging to prevent fighting
    if (dragging) return;

    const gx = Number(ev.gamma)||0; // left-right tilt
    const gy = Number(ev.beta)||0;  // front-back tilt
    hasGyro = true;

    // Gentle drift: update velocity not position (feels smoother)
    // beta baseline: around 20-30 when holding phone naturally; subtract 20 for “neutral”
    vx += gx * gyroGain * 8;
    vy += (gy - 20) * gyroGain * 4;

    vx = clamp(vx, -14, 14);
    vy = clamp(vy, -14, 14);

    ensureRAF();
  };

  if (enableGyro){
    window.addEventListener('deviceorientation', onGyro, { passive:true });
  }

  // Start with a clean state
  sync();

  function destroy(){
    try{ stage.removeEventListener('pointerdown', onPointerDown); }catch(_){}
    try{ window.removeEventListener('pointermove', onPointerMove); }catch(_){}
    try{ window.removeEventListener('pointerup', onPointerUp); }catch(_){}
    try{ window.removeEventListener('pointercancel', onPointerUp); }catch(_){}
    try{ window.removeEventListener('blur', onPointerUp); }catch(_){}
    try{ window.removeEventListener('deviceorientation', onGyro); }catch(_){}
    try{ if (raf){ cancelAnimationFrame(raf); raf = 0; } }catch(_){}
  }

  return {
    recenter,
    destroy,
    getOffset,
    setEnabled,
    get enabled(){ return enabled; },
    get gyroEnabled(){ return !!enableGyro; },
    get hasGyro(){ return !!hasGyro; }
  };
}
