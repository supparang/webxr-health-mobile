// === Hero Health — hub.js ===
// เลือกโหมด / diff / time แล้ว redirect ไป index.vr.html
// รองรับ data-ready="0" สำหรับโหมดที่ยังไม่พร้อมใช้งาน

'use strict';

(function () {

  function $(sel) { return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

  const MODES = ['goodjunk','groups','hydration','plate'];
  let currentMode = null;

  function showToast(msg){
    let t = $('#hub-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'hub-toast';
      Object.assign(t.style,{
        position:'fixed',
        bottom:'20px',
        left:'50%',
        transform:'translateX(-50%)',
        background:'rgba(15,23,42,0.95)',
        border:'1px solid rgba(148,163,184,0.9)',
        borderRadius:'999px',
        padding:'8px 14px',
        color:'#e5e7eb',
        fontSize:'12px',
        fontFamily:'system-ui',
        zIndex:9999,
        opacity:0,
        transition:'opacity .25s ease'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = 1;
    setTimeout(()=>{ t.style.opacity = 0; },2000);
  }

  function selectMode(modeId){
    if(!MODES.includes(modeId)) return;

    const card = document.querySelector(`.card[data-mode="${modeId}"]`);
    if(!card) return;

    const ready = card.getAttribute('data-ready') === '1';
    if(!ready){
      showToast('โหมดนี้ยังไม่พร้อมใช้งาน');
      return;
    }

    currentMode = modeId;

    // ลบ active ทั้งหมด
    $all('.card').forEach(c => c.classList.remove('active'));

    // ใส่ active ที่เลือก
    card.classList.add('active');
  }

  function initModeCards(){
    const cards = $all('.card[data-mode]');
    cards.forEach(card=>{
      const modeId = card.getAttribute('data-mode');
      card.addEventListener('click',()=>selectMode(modeId));
    });

    // ตั้งค่าเริ่มต้น = goodjunk ถ้ามีพร้อม
    const firstReady = cards.find(c=>c.getAttribute('data-ready')==='1');
    if(firstReady){
      selectMode(firstReady.getAttribute('data-mode'));
    }
  }

  function clampTime(sec){
    let n = parseInt(sec,10);
    if(isNaN(n)) n = 60;
    return Math.min(180, Math.max(20,n));
  }

  function onStartClick(){
    if(!currentMode){
      showToast('กรุณาเลือกโหมดเกมก่อน');
      return;
    }

    const card = document.querySelector(`.card[data-mode="${currentMode}"]`);
    if(!card || card.getAttribute('data-ready')!=='1'){
      showToast('โหมดนี้ยังไม่พร้อมเปิดเล่น');
      return;
    }

    const diffSel = $('#selDiff');
    const timeInp = $('#inpTime');

    const diff = diffSel ? diffSel.value : 'normal';
    const timeVal = clampTime(timeInp ? timeInp.value : 60);
    if(timeInp) timeInp.value = String(timeVal);

    const params = new URLSearchParams();
    params.set('mode', currentMode);
    params.set('diff', diff);
    params.set('time', String(timeVal));

    const url = './index.vr.html?' + params.toString();
    window.location.href = url;
  }

  function initStartButton(){
    const btn = $('#btnStart');
    if(btn){
      btn.addEventListener('click', onStartClick);
    }
  }

  function bootstrap(){
    initModeCards();
    initStartButton();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
