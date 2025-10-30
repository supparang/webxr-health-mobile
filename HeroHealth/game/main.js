// === Screen State helpers (menu | play | result) ===
function setState(name){
  document.body.classList.remove('state-menu','state-play','state-result');
  document.body.classList.add(`state-${name}`);
}
function showMenu(){  setState('menu');   }
function showPlay(){  setState('play');   }
function showResult(){setState('result'); }

// --- Wire basic buttons (menu/start/home/replay)
(function wireUIStable(){
  // namespace ให้ระบบหลักเรียกได้
  window.HHA = window.HHA || {};

  // ให้ engine เรียกเปิด/ปิดสนามแบบเดียวกัน
  window.HHA.setPlayfieldActive = (on)=>{
    if (on) setState('play'); else setState('menu');
  };

  // ปุ่ม
  const btnStart  = document.getElementById('btn_start');
  const btnHome   = document.querySelector('[data-result="home"]');
  const btnReplay = document.querySelector('[data-result="replay"]');

  // start: สลับไปหน้าเล่น + เรียกโหมดที่เลือก (ถ้า engine เคยผูก)
  btnStart?.addEventListener('click', (e)=>{
    e.preventDefault();
    // ถ้า main engine มีวิธีเริ่มโหมด ให้ใช้เลย
    if (typeof window.HHA.startSelectedMode === 'function'){
      showPlay();
      window.HHA.startSelectedMode();
    } else {
      // fallback: สั่ง engine ตรงๆ
      try { loadMode((new URLSearchParams(location.search).get('mode')) || 'goodjunk'); } catch {}
      showPlay();
      startGame();
    }
  });

  btnHome?.addEventListener('click', (e)=>{
    e.preventDefault();
    try { window.HHA.stop?.(); } catch {}
    stopGame();
    showMenu();
  });

  btnReplay?.addEventListener('click', (e)=>{
    e.preventDefault();
    showPlay();
    try { window.HHA.replay?.(); startGame(); } catch { startGame(); }
  });

  // เปิดมาที่หน้าเมนูเสมอ
  showMenu();
})();
