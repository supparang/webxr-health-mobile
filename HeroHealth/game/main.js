// === /HeroHealth/game/main.js (2025-11-12 stable boot) ===
import GameHub from '../vr/hub.js';

let hub = null;

function on(el, ev, fn, opts){ if(el && el.addEventListener) el.addEventListener(ev, fn, opts||false); }
function qs(s){ return document.querySelector(s); }
function qsa(s){ return document.querySelectorAll(s); }

function announceHudReady(){
  try{
    window.dispatchEvent(new CustomEvent('hha:hud-ready',{detail:{anchorId:'hudTop',scoreBox:true}}));
  }catch(_){}
}

function boot(){
  announceHudReady();
  let tries=0, id=setInterval(()=>{ announceHudReady(); if(++tries>15) clearInterval(id); },150);

  // สร้าง Hub
  hub = new GameHub();

  // ปุ่มเริ่ม
  const btnStart = qs('#btnStart');
  if (btnStart){
    on(btnStart,'click',e=>{
      try{ e.preventDefault(); }catch(_){}
      hub && hub.startGame && hub.startGame();
    });
  }

  // ปุ่มเลือกโหมด (ถ้ามี)
  const modeBtns = qsa('[data-mode]');
  for (let i=0;i<modeBtns.length;i++){
    const b = modeBtns[i];
    on(b,'click',e=>{
      try{ e.preventDefault(); }catch(_){}
      const m = b.getAttribute('data-mode') || 'goodjunk';
      hub && hub.selectMode && hub.selectMode(m);
    });
  }

  // pause/resume by visibility
  on(document,'visibilitychange',()=>{
    try{
      if(document.hidden) window.dispatchEvent(new Event('hha:pause'));
      else window.dispatchEvent(new Event('hha:resume'));
    }catch(_){}
  });

  // ปิดคลิกเป้าหลังจบเกม
  on(window,'hha:end',()=>{
    try { document.getElementById('spawnHost')?.classList.add('no-hit'); } catch(_){}
  });

  console.log('[main] ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
