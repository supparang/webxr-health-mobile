// === /herohealth/hydration-vr/hydration-vr.js ===
// Controller หน้า Hydration VR – คุมปุ่ม Start/Stop + diff + time

'use strict';

import { boot as bootHydration } from './hydration.safe.js';

let currentInstance = null;
let isRunning = false;
let currentDiff = 'easy';
let currentDur = 60;

function $(sel) {
  return document.querySelector(sel);
}

function setupUI() {
  const diffSel   = $('#hv-diff');
  const timeRange = $('#hv-time');
  const timeLabel = $('#hv-time-label');
  const btnStart  = $('#hv-btn-start');
  const btnStop   = $('#hv-btn-stop');
  const statusEl  = $('#hv-status');

  // --- difficulty select ---
  if (diffSel) {
    const applyDiff = () => {
      currentDiff = String(diffSel.value || 'easy').toLowerCase();
      if (!['easy', 'normal', 'hard'].includes(currentDiff)) {
        currentDiff = 'normal';
      }
    };
    diffSel.addEventListener('change', applyDiff);
    applyDiff();
  }

  // --- time slider ---
  if (timeRange) {
    const applyTime = () => {
      let v = parseInt(timeRange.value, 10);
      if (Number.isNaN(v)) v = 60;
      if (v < 20)  v = 20;
      if (v > 180) v = 180;
      currentDur = v;
      if (timeLabel) {
        timeLabel.textContent = `${v}s`;
      }
    };
    timeRange.addEventListener('input', applyTime);
    applyTime();
  } else if (timeLabel) {
    timeLabel.textContent = `${currentDur}s`;
  }

  // --- Start button ---
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      if (isRunning) return;

      isRunning = true;
      btnStart.disabled = true;
      if (btnStop) btnStop.disabled = false;

      if (statusEl) {
        statusEl.textContent =
          `กำลังเล่น Hydration (${currentDiff}, ${currentDur}s) – ตีเป้าน้ำดี เลี่ยงน้ำหวาน!`;
      }

      // ทำลาย instance เดิมถ้ามี
      if (currentInstance && typeof currentInstance.destroy === 'function') {
        try {
          currentInstance.destroy();
        } catch (e) {
          console.warn('[HydrationVR] destroy previous instance error', e);
        }
      }

      try {
        currentInstance = await bootHydration({
          difficulty: currentDiff,
          duration:   currentDur
        });
      } catch (err) {
        console.error('[HydrationVR] boot error', err);
        isRunning = false;
        btnStart.disabled = false;
        if (btnStop) btnStop.disabled = true;
        if (statusEl) {
          statusEl.textContent = 'เกิดข้อผิดพลาดในการเริ่มโหมด Hydration';
        }
      }
    });
  }

  // --- Stop button ---
  if (btnStop) {
    btnStop.addEventListener('click', () => {
      if (!isRunning) return;
      isRunning = false;

      if (currentInstance) {
        try {
          if (typeof currentInstance.stop === 'function') {
            currentInstance.stop();
          } else if (typeof currentInstance.destroy === 'function') {
            currentInstance.destroy();
          }
        } catch (e) {
          console.warn('[HydrationVR] stop/destroy error', e);
        }
      }

      btnStop.disabled = true;
      if (btnStart) btnStart.disabled = false;
      if (statusEl) {
        statusEl.textContent = 'หยุดเล่น Hydration แล้ว';
      }
    });
    btnStop.disabled = true;
  }

  // --- เมื่อจบเกมจาก engine (hha:end มาจาก hydration.safe.js) ---
  window.addEventListener('hha:end', ev => {
    const d = ev.detail || {};
    if (d.mode !== 'Hydration') return;

    isRunning = false;
    if (btnStart) btnStart.disabled = false;
    if (btnStop)  btnStop.disabled  = true;

    if (statusEl) {
      const score   = d.score ?? 0;
      const green   = d.greenTick ?? 0;
      const miss    = d.misses ?? 0;
      const gDone   = d.goalsCleared ?? 0;
      const gTotal  = d.goalsTotal ?? 0;
      const mDone   = d.questsCleared ?? 0;
      const mTotal  = d.questsTotal ?? 0;

      statusEl.textContent =
        `จบเกม – คะแนน ${score} | GREEN ${green}s | MISS ${miss} | Goals ${gDone}/${gTotal} | Mini ${mDone}/${mTotal}`;
    }

    if (currentInstance && typeof currentInstance.destroy === 'function') {
      try {
        currentInstance.destroy();
      } catch (e) {
        console.warn('[HydrationVR] destroy after end error', e);
      }
    }
    currentInstance = null;
  });
}

// เริ่มเมื่อ DOM พร้อม
window.addEventListener('DOMContentLoaded', () => {
  setupUI();
});