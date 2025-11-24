// === js/shadow-breaker.js — bootstrap Shadow Breaker page ===
'use strict';

import { initShadowBreaker } from './engine.js';

let currentGame = null;
let currentMode = 'normal'; // normal | research

const $  = (s) => document.querySelector(s);

function setMode(mode) {
  currentMode = mode === 'research' ? 'research' : 'normal';

  const normalBtn   = $('#modeNormalBtn');
  const researchBtn = $('#modeResearchBtn');
  const researchPanel = $('#researchPanel');
  const csvBtn = $('#csvBtn');

  if (currentMode === 'research') {
    normalBtn.classList.remove('primary');
    normalBtn.classList.add('ghost');
    researchBtn.classList.remove('ghost');
    researchBtn.classList.add('primary');
    researchPanel?.classList.remove('hidden');
    csvBtn?.classList.remove('hidden');
  } else {
    normalBtn.classList.add('primary');
    normalBtn.classList.remove('ghost');
    researchBtn.classList.add('ghost');
    researchBtn.classList.remove('primary');
    researchPanel?.classList.add('hidden');
    csvBtn?.classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const wrap       = document.getElementById('shadowWrap');
  const diffSelect = $('#diffSelect');
  const timeSelect = $('#timeSelect');
  const startBtn   = $('#startBtn');

  // อ่านค่าโหมดจาก URL ?mode=normal|research
  const url = new URL(window.location.href);
  const urlMode = url.searchParams.get('mode');
  const initialMode = urlMode === 'research' ? 'research' : 'normal';
  setMode(initialMode);

  $('#modeNormalBtn')?.addEventListener('click', () => setMode('normal'));
  $('#modeResearchBtn')?.addEventListener('click', () => setMode('research'));

  startBtn?.addEventListener('click', () => {
    try {
      // ถ้ามีเกมเก่าอยู่ → จบก่อน (กัน timer ซ้อน)
      if (currentGame) {
        currentGame.endGame('restart');
        currentGame = null;
      }

      const diff = (diffSelect?.value || 'normal').toLowerCase();
      const timeSec = parseInt(timeSelect?.value || '60', 10) || 60;

      // mapping diff → boss index (ไว้ใช้เปลี่ยนสีปุ่ม/portrait ตาม css)
      let bossIndex = 1;
      if (diff === 'easy') bossIndex = 0;
      else if (diff === 'normal') bossIndex = 1;
      else if (diff === 'hard') bossIndex = 2;

      if (wrap) {
        wrap.dataset.diff = diff;
        wrap.dataset.phase = '1';
        wrap.dataset.boss = String(bossIndex);
      }

      // เรียก engine.js ให้เริ่มเกมใน .sb-field ของหน้านี้เลย
      currentGame = initShadowBreaker({
        host: wrap,
        difficulty: diff,
        durationSec: timeSec,
        bossIndex
        // (ภายหลังค่อยเพิ่มค่าเกี่ยวกับ research logger เช่น participantId)
      });

      // debug เฉย ๆ
      console.log('[ShadowBreaker] start', {
        mode: currentMode,
        diff,
        timeSec
      });

      if (currentMode === 'research') {
        const pid  = $('#participantId')?.value?.trim() || '';
        const note = $('#researchNote')?.value?.trim() || '';
        console.log('[ShadowBreaker] research meta', { participantId: pid, note });
      }
    } catch (err) {
      console.error('Shadow Breaker start failed', err);
      alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า หรือแจ้งผู้ดูแลระบบ');
    }
  });
});
