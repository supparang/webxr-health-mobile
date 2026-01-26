// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PATCH (null-safe mount)
// ✅ ENTER VR / EXIT / RECENTER (ถ้าคุณมีของเดิมอยู่แล้ว เอาเฉพาะ patch ส่วน mount ก็ได้)
// ✅ Crosshair overlay + tap-to-shoot => dispatch hha:shoot
(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const emit = (name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch{} };

  function domReady(fn){
    if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
    else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }

  function safeMount(){
    // ✅ สำคัญ: body อาจยัง null ในบางกรณี (โดยเฉพาะถ้า script ไม่ defer/async)
    // ใช้ documentElement เป็น fallback
    return DOC.body || DOC.documentElement;
  }

  function ensureCrosshair(){
    const mount = safeMount();
    if(!mount) return null;

    let ch = DOC.getElementById('hhaCrosshair');
    if(ch) return ch;

    ch = DOC.createElement('div');
    ch.id = 'hhaCrosshair';
    ch.style.position = 'fixed';
    ch.style.left = '50%';
    ch.style.top = '50%';
    ch.style.transform = 'translate(-50%,-50%)';
    ch.style.width = '18px';
    ch.style.height = '18px';
    ch.style.border = '2px solid rgba(229,231,235,.9)';
    ch.style.borderRadius = '999px';
    ch.style.boxShadow = '0 0 0 3px rgba(2,6,23,.55)';
    ch.style.pointerEvents = 'none';
    ch.style.zIndex = '9999';
    ch.style.display = 'none'; // เปิดเฉพาะ cVR หรือโหมดที่ต้องการ

    mount.appendChild(ch);
    return ch;
  }

  function showCrosshair(on){
    const ch = ensureCrosshair();
    if(!ch) return;
    ch.style.display = on ? 'block' : 'none';
  }

  let lastShoot = 0;

  function onTapShoot(){
    const now = Date.now();
    if(now - lastShoot < CFG.cooldownMs) return;
    lastShoot = now;

    emit('hha:shoot', { x: WIN.innerWidth/2, y: WIN.innerHeight/2, lockPx: CFG.lockPx, source:'tap' });
  }

  function getView(){
    try{
      const v = new URL(location.href).searchParams.get('view');
      return (v||'').toLowerCase();
    }catch{ return ''; }
  }

  domReady(()=>{
    // เปิด crosshair เฉพาะ cvr strict
    const view = getView();
    if(view === 'cvr') showCrosshair(true);

    // tap-to-shoot เฉพาะ cvr
    if(view === 'cvr'){
      DOC.addEventListener('click', onTapShoot, { passive:true });
      DOC.addEventListener('touchstart', onTapShoot, { passive:true });
    }

    // NOTE: ปุ่ม EnterVR/Exit/Recenter ของคุณ (ถ้ามีอยู่แล้ว) ให้คงของเดิมได้
    // ตรงนี้แพตช์หลักคือเรื่อง mount + crosshair ไม่พัง
  });
})();