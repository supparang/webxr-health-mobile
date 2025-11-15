// === Hero Health — hub.js (3D Cards + Preview + Sound + Student Profile) ===

'use strict';

(function(){
  function $(s){ return document.querySelector(s); }
  function $all(s){ return Array.from(document.querySelectorAll(s)); }

  let currentMode = null;

  // ---- เสียง ----
  const s_click = new Audio('./assets/sound/click.mp3');
  const s_hover = new Audio('./assets/sound/hover.mp3');
  s_click.volume = 0.6;
  s_hover.volume = 0.45;

  // ---- Toast ----
  function toast(msg){
    let t = $('#hub-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'hub-toast';
      Object.assign(t.style,{
        position:'fixed',bottom:'26px',left:'50%',
        transform:'translateX(-50%)',
        background:'rgba(15,23,42,0.95)',
        border:'1px solid #38bdf8',
        padding:'8px 14px',borderRadius:'12px',
        color:'#e5e7eb',fontSize:'13px',
        transition:'0.25s ease',opacity:0,zIndex:9999
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = 1;
    setTimeout(()=>{ t.style.opacity = 0; },1600);
  }

  function selectMode(mode){
    const card = document.querySelector(`.card[data-mode="${mode}"]`);
    if(!card) return;

    const isReady = card.getAttribute('data-ready') !== '0';
    if(!isReady){ toast("โหมดนี้ยังไม่พร้อมใช้งาน"); return; }

    $all('.card').forEach(c=>c.classList.remove('active'));
    card.classList.add('active');

    s_click.currentTime = 0;
    s_click.play();

    currentMode = mode;
  }

  function initCards(){
    $all('.card').forEach(card=>{
      const mode = card.getAttribute('data-mode');

      card.addEventListener('click',()=>selectMode(mode));

      card.addEventListener('mouseenter',()=>{
        if(card.getAttribute('data-ready')==='0') return;
        s_hover.currentTime = 0;
        s_hover.play();
      });
    });
  }

  function clampTime(n){
    n = parseInt(n,10);
    if(isNaN(n)) return 60;
    return Math.max(20,Math.min(180,n));
  }

  function onStart(){
    if(!currentMode){
      toast("กรุณาเลือกโหมดก่อน");
      return;
    }

    // โปรไฟล์เด็ก
    const name = $('#stName').value.trim();
    const room = $('#stRoom').value.trim();
    const age  = $('#stAge').value.trim();

    if(!name){
      toast("กรุณากรอกชื่อนักเรียน");
      return;
    }

    const diff = $('#selDiff').value;
    const time = clampTime($('#inpTime').value);

    const params = new URLSearchParams();
    params.set('mode', currentMode);
    params.set('diff', diff);
    params.set('time', time);
    params.set('stName', name);
    params.set('stRoom', room);
    params.set('stAge', age);

    window.location.href = './index.vr.html?' + params.toString();
  }

  function init(){
    initCards();
    $('#btnStart').addEventListener('click', onStart);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})();
