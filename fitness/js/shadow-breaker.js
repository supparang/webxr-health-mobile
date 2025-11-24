// === shadow-breaker.js — bootstrap & menu wiring ===
'use strict';

import { initShadowBreaker } from './js/engine.js';

let currentGame = null;
let currentMode = 'normal'; // normal | research

function $(sel) {
  return document.querySelector(sel);
}

function setMode(mode) {
  currentMode = mode;
  const normalBtn = $('#modeNormalBtn');
  const researchBtn = $('#modeResearchBtn');
  const researchPanel = $('#researchPanel');
  const csvBtn = $('#csvBtn');

  if (mode === 'research') {
    normalBtn.classList.remove('primary');
    normalBtn.classList.add('ghost');
    researchBtn.classList.remove('ghost');
    researchBtn.classList.add('primary');
    researchPanel.classList.remove('hidden');
    csvBtn.classList.remove('hidden');
  } else {
    normalBtn.classList.add('primary');
    normalBtn.classList.remove('ghost');
    researchBtn.classList.add('ghost');
    researchBtn.classList.remove('primary');
    researchPanel.classList.add('hidden');
    csvBtn.classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('shadowWrap') || document.querySelector('.sb-wrap');
  const diffSelect = $('#diffSelect');
  const timeSelect = $('#timeSelect');
  const startBtn = $('#startBtn');

  $('#modeNormalBtn')?.addEventListener('click', () => setMode('normal'));
  $('#modeResearchBtn')?.addEventListener('click', () => setMode('research'));

  startBtn?.addEventListener('click', () => {
    try {
      if (currentGame) {
        // จบเกมเดิมถ้ามี
        currentGame.endGame('restart');
        currentGame = null;
      }

      const diff = (diffSelect?.value || 'normal').toLowerCase();
      const timeSec = parseInt(timeSelect?.value || '60', 10) || 60;

      wrap.dataset.diff = diff;
      wrap.dataset.phase = '1';

      // mapping ความยาก → boss index (0–3)
      let bossIndex = 1;
      if (diff === 'easy') bossIndex = 0;
      else if (diff === 'normal') bossIndex = 1;
      else if (diff === 'hard') bossIndex = 2;
      wrap.dataset.boss = String(bossIndex);

      currentGame = initShadowBreaker({
        host: wrap,
        difficulty: diff,
        durationSec: timeSec,
        bossIndex
      });

      // TODO: โหมด research + logger จะใส่ในงานใหญ่ 3
      if (currentMode === 'research') {
        const pid = $('#participantId')?.value?.trim() || '';
        const note = $('#researchNote')?.value?.trim() || '';
        console.log('[ShadowBreaker] research mode start', { participantId: pid, note });
      }
    } catch (err) {
      console.error('Shadow Breaker start failed', err);
      alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้าหรือแจ้งผู้ดูแลระบบ');
    }
  });

  // ค่าเริ่มต้น = normal mode
  setMode('normal');
});
