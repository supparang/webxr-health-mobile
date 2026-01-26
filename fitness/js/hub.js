'use strict';

(function(){
  const modeNormal = document.getElementById('mode-normal');
  const modeResearch = document.getElementById('mode-research');
  const modeDesc = document.getElementById('mode-desc');

  function setMode(m){
    modeNormal?.classList.toggle('active', m === 'normal');
    modeResearch?.classList.toggle('active', m === 'research');
    if (modeDesc) {
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
      if (g === 'shadow' || g === 'shadow-vr') location.href = './shadow-breaker.html';
      if (g === 'rhythm') alert('Rhythm Boxer: ยังไม่ปล่อยในชุดนี้');
      if (g === 'jump') alert('Jump-Duck: ยังไม่ปล่อยในชุดนี้');
    });
  });

  setMode('normal');
})();