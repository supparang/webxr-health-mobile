// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — SAFE THIN BOOT — v20260217b
// Goal: DO NOT control game state. Only handles mobile tap-to-start unlock + overlay sanity.

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
    return /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    // รองรับ view=mobile (จากลิงก์ของคุณ) โดยไม่ให้พัง
    if(v === 'mobile') return 'mobile';
    if(v === 'cvr' || v === 'cardboard') return 'cvr';
    if(v === 'vr') return 'vr';
    return v || (isMobile() ? 'mobile' : 'pc');
  }

  function ensureStartState(){
    // เริ่มต้นต้องเป็น menu เสมอ
    try{
      if(wrap) wrap.dataset.state = 'menu';
      if(menu) menu.style.display = 'grid';
      if(end) end.hidden = true;
    }catch{}
  }

  // ปลดล็อก gesture (เสียง/ทัช) — ไม่ยุ่งเกม
  function unlockGesture(){
    try{
      // trick: play/pause silent audio
      const a = new Audio();
      a.muted = true;
      a.play().then(()=>{ a.pause(); }).catch(()=>{});
    }catch{}
  }

  function showTapStartIfNeeded(){
    const v = normalizeView(qs('view',''));
    DOC.body.setAttribute('data-view', v);
    if(wrap) wrap.dataset.view = v;

    // ถ้าเป็นมือถือ หรือ view=mobile/cvr ให้โชว์ tapStart
    const need = (isMobile() || v==='mobile' || v==='cvr');
    if(!tapStart) return;

    if(need){
      tapStart.style.display = 'grid';
    }else{
      tapStart.style.display = 'none';
    }
  }

  function wire(){
    ensureStartState();
    showTapStartIfNeeded();

    if(tapBtn){
      tapBtn.addEventListener('click', ()=>{
        unlockGesture();
        if(tapStart) tapStart.style.display = 'none';
        // ยังอยู่ที่ MENU ให้ผู้ใช้กด "เริ่มเกม" เอง
        try{ const btnStart = $id('btnStart'); btnStart && btnStart.focus(); }catch{}
      }, {passive:true});
    }

    // กันเคสกลับมาจาก bfcache แล้วค้าง end overlay
    WIN.addEventListener('pageshow', ensureStartState, {passive:true});
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', wire, {once:true});
  }else{
    wire();
  }
})();