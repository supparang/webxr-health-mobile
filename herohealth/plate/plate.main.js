// === /herohealth/plate/plate.main.js
'use strict';

import PlateMode from './plate.mode.js';

const url = new URL(window.location.href);
let diff = (url.searchParams.get('diff') || 'normal').toLowerCase();

let duration = parseInt(url.searchParams.get('time'), 10);
if (isNaN(duration) || duration <= 0) {
  duration = 60;
}
if (duration < 20) duration = 20;
if (duration > 180) duration = 180;

let timerId = null;
let secLeft = duration;
let ctrl = null;

function emitTime(sec) {
  try {
    window.dispatchEvent(new CustomEvent('hha:time', { detail: { sec } }));
  } catch {}
}

function formatTime(sec) {
  const s = Math.max(0, sec | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function updateTimeHud(sec) {
  const el = document.querySelector('[data-hud="time"]');
  if (el) el.textContent = formatTime(sec);
}

function stopGameTimer() {
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
}

async function startGame() {
  stopGameTimer();
  secLeft = duration;
  updateTimeHud(secLeft);
  emitTime(secLeft);

  if (ctrl && typeof ctrl.stop === 'function') {
    ctrl.stop();
  }

  ctrl = await PlateMode.boot({
    difficulty: diff,
    duration
  });

  timerId = window.setInterval(() => {
    secLeft--;
    if (secLeft < 0) secLeft = 0;
    updateTimeHud(secLeft);
    emitTime(secLeft);
    if (secLeft <= 0) {
      stopGameTimer();
    }
  }, 1000);
}

// HUD listener จาก plate.mode.js
window.addEventListener('hha:hud', (e) => {
  const d = e.detail || {};
  const scoreEl  = document.querySelector('[data-hud="score"]');
  const comboEl  = document.querySelector('[data-hud="combo"]');
  const missEl   = document.querySelector('[data-hud="miss"]');
  const groupsEl = document.querySelector('[data-hud="groups"]');

  if (scoreEl) scoreEl.textContent = d.score ?? 0;
  if (comboEl) comboEl.textContent = d.combo ?? 0;
  if (missEl)  missEl.textContent  = d.misses ?? 0;

  if (groupsEl && Array.isArray(d.gCounts)) {
    groupsEl.textContent = d.gCounts
      .map((v, i) => `หมู่ ${i + 1}: ${v}`)
      .join(' | ');
  }
});

// Quest HUD
window.addEventListener('quest:update', (e) => {
  const d = e.detail || {};
  const goalEl = document.querySelector('[data-hud="goal"]');
  const miniEl = document.querySelector('[data-hud="mini"]');
  const hintEl = document.querySelector('[data-hud="hint"]');

  if (goalEl) goalEl.textContent = d.goal?.label || '—';
  if (miniEl) miniEl.textContent = d.mini?.label || '—';
  if (hintEl && d.hint) hintEl.textContent = d.hint;
});

// Summary panel
window.addEventListener('hha:end', (e) => {
  const d = e.detail || {};
  const panel = document.querySelector('#plate-result');
  if (!panel) return;

  panel.hidden = false;

  const scoreEl   = panel.querySelector('[data-result="score"]');
  const missEl    = panel.querySelector('[data-result="misses"]');
  const comboEl   = panel.querySelector('[data-result="comboMax"]');
  const goalsEl   = panel.querySelector('[data-result="goals"]');
  const questsEl  = panel.querySelector('[data-result="quests"]');

  if (scoreEl)  scoreEl.textContent  = d.score ?? 0;
  if (missEl)   missEl.textContent   = d.misses ?? 0;
  if (comboEl)  comboEl.textContent  = d.comboMax ?? 0;
  if (goalsEl)  goalsEl.textContent  = `${d.goalsCleared || 0} / ${d.goalsTotal || 0}`;
  if (questsEl) questsEl.textContent = `${d.questsCleared || 0} / ${d.questsTotal || 0}`;
});

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.querySelector('[data-action="start"]');
  const retryBtn = document.querySelector('[data-action="retry"]');
  const backBtn  = document.querySelector('[data-action="back-hub"]');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startBtn.disabled = true;
      startGame().catch(console.error);
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const panel = document.querySelector('#plate-result');
      if (panel) panel.hidden = true;
      startGame().catch(console.error);
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = './hub.html?from=plate';
    });
  }
});
