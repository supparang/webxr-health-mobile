// === /fitness/hub.js ===
'use strict';

(function(){
  const qs = (s)=>document.querySelector(s);

  const btnNormal = qs('#mode-normal');
  const btnResearch = qs('#mode-research');
  const desc = qs('#mode-desc');

  let mode = 'normal';

  function setMode(m){
    mode = m === 'research' ? 'research' : 'normal';
    if (btnNormal) btnNormal.classList.toggle('active', mode === 'normal');
    if (btnResearch) btnResearch.classList.toggle('active', mode === 'research');

    if (desc){
      desc.textContent = (mode === 'normal')
        ? 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)'
        : 'Research: สำหรับเก็บข้อมูลงานวิจัย (แนะนำให้กรอกรหัส/กลุ่มในหน้าเกม แล้วดาวน์โหลด CSV)';
    }
  }

  function openGame(gameKey){
    if (gameKey === 'shadow'){
      // โหมด research แค่ “ตั้งค่า” ให้หน้าเกมรู้ว่ามาจาก hub แบบวิจัย
      // แต่เกมยังให้เลือกกด Play/Research เองในหน้าเมนู
      const url = (mode === 'research')
        ? './shadow-breaker.html?from=hub&mode=research'
        : './shadow-breaker.html?from=hub&mode=play';
      location.href = url;
      return;
    }

    alert('เกมนี้ยังไม่เปิดในแพ็คทดสอบชุดนี้');
  }

  if (btnNormal) btnNormal.addEventListener('click', ()=>setMode('normal'));
  if (btnResearch) btnResearch.addEventListener('click', ()=>setMode('research'));

  document.addEventListener('click', (e)=>{
    const el = e.target && e.target.closest ? e.target.closest('[data-game]') : null;
    if (!el) return;
    const key = el.getAttribute('data-game');
    if (!key || el.classList.contains('btn-disabled')) return;
    openGame(key);
  });

  setMode('normal');
})();