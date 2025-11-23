// /fitness/hub.js
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const btnNormal   = document.getElementById('mode-normal');
  const btnResearch = document.getElementById('mode-research');
  const modeDesc    = document.getElementById('mode-desc');
  const gameButtons = document.querySelectorAll('.game-actions .btn');

  let currentMode = 'normal';

  const desc = {
    normal: 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)',
    research: 'Research: สำหรับเก็บข้อมูลงานวิจัย (บันทึก CSV, offset ฯลฯ — แนะนำให้กรอก Participant ID)'
  };

  const routes = {
    shadow: {
      normal:   'shadow-breaker.html?mode=normal',
      research: 'shadow-breaker.html?mode=research'
    },
    'shadow-vr': {
      normal:   'vr-shadow-breaker.html?mode=normal',
      research: 'vr-shadow-breaker.html?mode=research'
    },
    rhythm: {
      normal:   'rhythm-boxer.html?mode=normal',
      research: 'rhythm-boxer.html?mode=research'
    },
    jump: {
      normal:   'jump-duck.html?mode=normal',
      research: 'jump-duck.html?mode=research'
    },
    balance: {
      normal:   'balance-hold.html?mode=normal',
      research: 'balance-hold.html?mode=research'
    }
  };

  function setMode(mode){
    currentMode = mode === 'research' ? 'research' : 'normal';
    btnNormal.classList.toggle('active', currentMode === 'normal');
    btnResearch.classList.toggle('active', currentMode === 'research');
    if (modeDesc) modeDesc.textContent = desc[currentMode];
    document.body.dataset.mode = currentMode;
  }

  btnNormal?.addEventListener('click', () => setMode('normal'));
  btnResearch?.addEventListener('click', () => setMode('research'));
  setMode('normal');

  gameButtons.forEach(btn => {
    const game = btn.dataset.game;
    if(!game) return;
    btn.addEventListener('click', () => {
      const map = routes[game];
      if(!map) return;
      const url = map[currentMode] || map.normal;
      window.location.href = url;
    });
  });
});
