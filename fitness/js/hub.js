'use strict';

(function(){
  const modeNormal = document.getElementById('mode-normal');
  const modeResearch = document.getElementById('mode-research');
  const modeDesc = document.getElementById('mode-desc');

  let mode = 'normal';

  function setMode(m){
    mode = m;
    modeNormal?.classList.toggle('active', m === 'normal');
    modeResearch?.classList.toggle('active', m === 'research');
    if(modeDesc){
      modeDesc.textContent = (m === 'research')
        ? 'Research: ใช้สำหรับเก็บข้อมูล (ต้องกรอกข้อมูลผู้เข้าร่วมในหน้าเกม)'
        : 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
    }
  }

  modeNormal?.addEventListener('click', ()=>setMode('normal'));
  modeResearch?.addEventListener('click', ()=>setMode('research'));

  document.querySelectorAll('[data-game]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const g = btn.getAttribute('data-game');
      if(g === 'shadow' || g === 'shadow-vr'){
        // ตอนนี้ shadow-breaker.html รองรับทั้ง normal/research ผ่านปุ่มภายใน
        location.href = './shadow-breaker.html';
      }
    });
  });

  setMode('normal');
})();