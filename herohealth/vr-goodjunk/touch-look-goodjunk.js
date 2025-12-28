// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// GoodJunkVR — Touch/Mouse Look (World-Shift Dodge) — PRODUCTION (FIXED)
// ✅ Drag เฉพาะ "พื้นว่าง" เพื่อเอียงโลก (targets/hazards ขยับ แต่ crosshair ไม่ขยับ)
// ✅ ไม่รบกวนการคลิกเป้า/ปุ่ม HUD
// ✅ เมาส์ขยับเฉย ๆ ไม่ทำให้โลกไหล (ต้องลากจริง)
// ✅ รองรับชื่อพารามิเตอร์ทั้งแบบใหม่ + แบบเดิมใน boot ของคุณ
// ✅ Exports: named + default + window fallback

'use strict';

function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function clamp(v, a, b){
  v = Number(v); if (!Number.isFinite(v)) v = 0;
  return Math.max(a, Math.min(b, v));
}
function safeEl(x){
  if (!x) return null;
  if (typeof x === 'string') return document.querySelector(x);
  return x;
}

function defaultShouldEnableGyro(){
  const g = String(qs('gyro','auto')).toLowerCase();
  if (g === '1' || g === 'true' || g === 'on') return true;
  if (g === '0' || g === 'false' || g === 'off') return false;

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

function makeIsTargetFn(layerEl){
  return function isTargetEl(el){
    if (!el) return false;

    // ✅ Robust: anything inside layer but not the layer itself => treat as target
    if (layerEl && layerEl.contains(el) && el !== layerEl) return true;

    // fallback selectors (เผื่อเกมอื่น)
    const sel = [
      '.gj-target','.goodjunk-target','.target',
      '[data-target]','.pl-target','.gr-target'
    ].join(',');
    return !!(el.closest && el.closest(sel));
  };
}

function applyTransform(els, x, y, z){
  const t = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z || 0}px)`;
  for (const e of els){
    if (!e) continue;
    e.style.transform = t;
  }
}

// NOTE: attachTouchLook accepts BOTH styles:
// - New: { stage, layer, ring, laser, maxShiftPx, gain, friction, spring, enableGyro }
// - Old (your boot): { layerEl, crosshairEl, maxShiftPx, ease }
function attachTouchLook(opts = {}){
  // ---- alias support (boot ของคุณใช้ layerEl/crosshairEl/ease) ----
  const stage = safeEl(opts.stage || opts.stageEl || '#gj-stage') || document.body;
  const layer = safeEl(opts.layer || opts.layerEl || '#gj-layer');
  const ring  = safeEl(opts.ring  || '#atk-ring');
  const laser = safeEl(opts.laser || '#atk-laser');

  const shiftEls = Array.isArray(opts.shiftEls)
    ? opts.shiftEls.map(safeEl).filter(Boolean)
    : [layer, ring, laser].filter(Boolean);

  const maxShift  = clamp(opts.maxShiftPx ?? 95, 40, 220);

  // opts.ease (0.08..0.2) -> map to gain/spring feel
  const ease = (opts.ease != null) ? clamp(opts.ease, 0.05, 0.30) : null;

  const gain      = clamp(opts.gain ?? (ease ? (0.18 + ease*0.6) : 0.24), 0.05, 0.80);
  const gyroGain  = clamp(opts.gyroGain ?? 0.055, 0.00, 0.25);
  const friction  = clamp(opts.friction ?? 0.86, 0.50, 0.98);
  const spring    = clamp(opts.spring ?? (ease ? clamp(0.10 + ease*0.8, 0.10, 0.35) : 0.18), 0.00, 0.45);
  const z         = Number(opts.z ?? 0);

  let enabled  = (opts.enabled !== false);
  let dragging = false;

  let px = 0, py = 0;
  let vx = 0, vy = 0;
  let lastX = 0, lastY = 0;
  let raf = 0;

  const enableGyro = (opts.enableGyro !== undefined) ? !!opts.enableGyro : defaultShouldEnableGyro();
  const isTargetEl = makeIsTargetFn(layer);

  function sync(){
    applyTransform(shiftEls, px, py, z);
    if (typeof opts.onChange === 'function'){
      try{ opts.onChange({ x:px, y:py, vx, vy, dragging, enabled }); }catch(_){}
    }
  }

  function ensureRAF(){
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick(){
    raf = 0;
    if (!enabled) return;

    vx *= friction;
    vy *= friction;

    if (!dragging){
      vx += (-px) * spring;
      vy += (-py) * spring;
    }

    px = clamp(px + vx, -maxShift, maxShift);
    py = clamp(py + vy, -maxShift, maxShift);

    // snap to center when calm
    if (!dragging && Math.abs(px) < 0.12 && Math.abs(py) < 0.12 && Math.abs(vx) < 0.12 && Math.abs(vy) < 0.12){
      px = 0; py = 0; vx = 0; vy = 0;
      sync();
      return;
    }

    sync();
    raf = requestAnimationFrame(tick);
  }

  function beginDrag(e){
    if (!enabled || !e) return;

    // ✅ ห้ามเริ่มลากถ้ากดโดนเป้าหรือ UI
    if (isTargetEl(e.target)) return;
    if (isInteractiveEl(e.target)) return;

    // mouse: ต้องเป็นคลิกซ้ายค้างจริง
    if (e.pointerType === 'mouse'){
      if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) return;
    }

    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    ensureRAF();
  }

  function moveDrag(e){
    if (!enabled || !dragging || !e) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    vx += dx * gain;
    vy += dy * gain;

    vx = clamp(vx, -26, 26);
    vy = clamp(vy, -26, 26);

    ensureRAF();
  }

  function endDrag(){ dragging = false; }

  function recenter(hard = true){
    if (hard){
      px = 0; py = 0; vx = 0; vy = 0;
      sync();
      return;
    }
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

  // pointer binds
  const onPointerDown = (e)=>{ beginDrag(e); };
  const onPointerMove = (e)=>{ moveDrag(e); };
  const onPointerUp   = ()=>{ endDrag(); };

  stage.addEventListener('pointerdown', onPointerDown, { passive:true });
  window.addEventListener('pointermove', onPointerMove, { passive:true });
  window.addEventListener('pointerup', onPointerUp, { passive:true });
  window.addEventListener('pointercancel', onPointerUp, { passive:true });
  window.addEventListener('blur', onPointerUp, { passive:true });

  // double tap/click empty stage => recenter
  let lastTap = 0;
  stage.addEventListener('pointerup', (e)=>{
    if (!enabled) return;
    if (isTargetEl(e.target) || isInteractiveEl(e.target)) return;
    const t = Date.now();
    if (t - lastTap < 260) recenter(true);
    lastTap = t;
  }, { passive:true });

  // gyro optional
  const onGyro = (ev)=>{
    if (!enabled || !enableGyro) return;
    if (dragging) return;

    const gx = Number(ev.gamma)||0;
    const gy = Number(ev.beta)||0;

    vx += gx * gyroGain * 8;
    vy += (gy - 20) * gyroGain * 4;

    vx = clamp(vx, -16, 16);
    vy = clamp(vy, -16, 16);

    ensureRAF();
  };

  if (enableGyro){
    window.addEventListener('deviceorientation', onGyro, { passive:true });
  }

  // initial
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

  return { recenter, destroy, setEnabled, getOffset:()=>({ x:px, y:py, vx, vy, dragging, enabled }) };
}

export { attachTouchLook };
export default attachTouchLook;

try{
  if (typeof window !== 'undefined'){
    window.attachTouchLook = attachTouchLook;
    window.GAME_MODULES = window.GAME_MODULES || {};
    window.GAME_MODULES.TouchLook = { attachTouchLook };
  }
}catch(_){}
