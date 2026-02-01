// === /fitness/hub.js ===
'use strict';

(function(){
  const qs = (s)=>document.querySelector(s);

  const btnNormal = qs('#mode-normal');
  const btnResearch = qs('#mode-research');
  const desc = qs('#mode-desc');

  let mode = 'normal';

  function setMode(m){
    mode = (m === 'research') ? 'research' : 'normal';

    if (btnNormal) btnNormal.classList.toggle('active', mode === 'normal');
    if (btnResearch) btnResearch.classList.toggle('active', mode === 'research');

    if (desc){
      desc.textContent = (mode === 'normal')
        ? 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)'
        : 'Research: สำหรับเก็บข้อมูลงานวิจัย (AI แสดง prediction แต่ “ล็อกไม่ให้ปรับเกม” 100%)';
    }
  }

  function openGame(gameKey){
    const modeParam = (mode === 'research') ? 'research' : 'play';

    if (gameKey === 'shadow'){
      location.href = `./shadow-breaker.html?from=hub&mode=${modeParam}`;
      return;
    }

    if (gameKey === 'rhythm'){
      // เปิด Rhythm Boxer จริง
      location.href = `./rhythm-boxer.html?from=hub&mode=${modeParam}`;
      return;
    }

    alert('เกมนี้ยังไม่เปิดในแพ็คทดสอบชุดนี้');
  }

  if (btnNormal) btnNormal.addEventListener('click', ()=>setMode('normal'));
  if (btnResearch) btnResearch.addEventListener('click', ()=>setMode('research'));

  document.addEventListener('click', (e)=>{
    const el = e.target && e.target.closest ? e.target.closest('[data-game]') : null;
    if (!el) return;
    if (el.classList.contains('btn-disabled')) return;

    const key = el.getAttribute('data-game');
    if (!key) return;

    openGame(key);
  });

  setMode('normal');
})();