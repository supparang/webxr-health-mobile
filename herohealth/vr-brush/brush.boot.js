// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — SAFE THIN BOOT — v20260217c
// ✅ ไม่ยุ่ง state เกม (ไม่เปิด END เอง)
// ✅ ทำแค่ Tap-to-start unlock + set start overlay = MENU เสมอ
// ✅ รองรับ view=mobile / cvr / pc

(function(){
  'use strict';

  const DOC = document;
  const WIN = window;

  const $id = (id)=>DOC.getElementById(id);

  const tapStart = $id('tapStart');
  const tapBtn   = $id('tapBtn');

  const menu = $id('br-menu');
  const end  = $id('br-end');
  const wrap = $id('br-wrap');

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function isMobile(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua) ||
      (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    // รองรับลิงก์เดิมของคุณ
    if(v === 'mobile') return 'mobile';
    if(v === 'cvr' || v === 'cardboard') return 'cvr';
    if(v === 'vr') return 'vr';
    return v || (isMobile() ? 'mobile' : 'pc');
  }

  function ensureStartState(){
    // เริ่มที่ MENU เสมอ
    try{
      if(wrap) wrap.dataset.state = 'menu';
      if(menu) menu.style.display = 'grid';
      if(end)  end.hidden = true;
    }catch(_){}
  }

  function unlockGesture(){
    // ปลดล็อก gesture (mobile) แบบไม่พัง
    try{
      const a = new Audio();
      a.muted = true;
      a.play().then(()=>{ try{ a.pause(); }catch(_){} }).catch(()=>{});
    }catch(_){}
  }

  function showTapStartIfNeeded(){
    const v = normalizeView(qs('view',''));
    try{ DOC.body.setAttribute('data-view', v); }catch(_){}
    try{ if(wrap) wrap.dataset.view = v; }catch(_){}

    // มือถือ/ cvr ให้โชว์ tapStart เพื่อ unlock ก่อน
    const need = (isMobile() || v==='mobile' || v==='cvr');
    if(!tapStart) return;
    tapStart.style.display = need ? 'grid' : 'none';
  }

  function wire(){
    ensureStartState();
    showTapStartIfNeeded();

    if(tapBtn){
      tapBtn.addEventListener('click', ()=>{
        unlockGesture();
        if(tapStart) tapStart.style.display = 'none';
        // ไม่ auto-start เกม ให้ผู้ใช้กด "เริ่มเกม" เอง
        try{ const btnStart = $id('btnStart'); btnStart && btnStart.focus(); }catch(_){}
      }, {passive:true});
    }

    // กัน bfcache / กลับมาหน้าเดิมแล้วค้าง END
    WIN.addEventListener('pageshow', ensureStartState, {passive:true});
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', wire, {once:true});
  }else{
    wire();
  }
})();