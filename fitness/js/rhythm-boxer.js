// === /fitness/js/rhythm-boxer.js ===
// หน้า Rhythm Boxer: จัดการ UI เมนู/เล่น/จบเกม แล้วเรียก engine

import { initRhythmEngine } from './rhythm-engine.js';

window.addEventListener('DOMContentLoaded', () => {
  // ---------- DOM refs ----------
  const viewMenu   = document.getElementById('view-menu');
  const viewPlay   = document.getElementById('view-play');
  const viewResult = document.getElementById('view-result');

  const btnModeResearch = document.querySelector('[data-action="mode-research"]');
  const btnModeNormal   = document.querySelector('[data-action="mode-normal"]');

  const selDiff   = document.getElementById('difficulty');
  const selTrack  = document.getElementById('track');
  const inpPid    = document.getElementById('participant-id');
  const inpGroup  = document.getElementById('participant-group');

  const btnStart  = document.querySelector('[data-action="start-play"]');
  const btnStop   = document.querySelector('[data-action="stop-early"]');
  const btnBack   = document.querySelector('[data-action="back-to-menu"]');
  const btnPlayAgain = document.querySelector('[data-action="play-again"]');

  // stats (play view)
  const statMode   = document.getElementById('stat-mode');
  const statDiff   = document.getElementById('stat-diff');
  const statTrack  = document.getElementById('stat-track');
  const statScore  = document.getElementById('stat-score');
  const statCombo  = document.getElementById('stat-combo');
  const statPerfect= document.getElementById('stat-perfect');
  const statMiss   = document.getElementById('stat-miss');
  const statTime   = document.getElementById('stat-time');

  // result
  const resMode    = document.getElementById('res-mode');
  const resDiff    = document.getElementById('res-diff');
  const resTrack   = document.getElementById('res-track');
  const resScore   = document.getElementById('res-score');
  const resCombo   = document.getElementById('res-maxcombo');
  const resPerfect = document.getElementById('res-perfect');
  const resMiss    = document.getElementById('res-miss');
  const resAcc     = document.getElementById('res-accuracy');
  const resTime    = document.getElementById('res-time');
  const resPid     = document.getElementById('res-participant');

  // ---------- state ----------
  let mode = 'normal'; // 'research' | 'normal'
  let lastConfig = null;

  function setMode(newMode) {
    mode = newMode;
    if (btnModeResearch) {
      btnModeResearch.classList.toggle('active', mode === 'research');
    }
    if (btnModeNormal) {
      btnModeNormal.classList.toggle('active', mode === 'normal');
    }
  }

  function showView(which) {
    if (viewMenu)   viewMenu.classList.toggle('hidden', which !== 'menu');
    if (viewPlay)   viewPlay.classList.toggle('hidden', which !== 'play');
    if (viewResult) viewResult.classList.toggle('hidden', which !== 'result');
  }

  setMode('normal');
  showView('menu');

  // ---------- init engine ----------
  const engine = initRhythmEngine({
    onTick(stats) {
      // เรียกทุก ~16ms ระหว่างเล่น
      if (!stats) return;
      statScore.textContent   = stats.score | 0;
      statCombo.textContent   = stats.combo | 0;
      statPerfect.textContent = stats.perfect | 0;
      statMiss.textContent    = stats.miss | 0;
      statTime.textContent    = stats.remaining.toFixed(1) + 's';
    },
    onEnd(stats) {
      // เกมจบ → แสดง result
      if (!stats) return;
      showView('result');

      resMode.textContent    = stats.modeLabel;
      resDiff.textContent    = stats.diffLabel;
      resTrack.textContent   = stats.trackLabel;
      resScore.textContent   = stats.score | 0;
      resCombo.textContent   = stats.maxCombo | 0;
      resPerfect.textContent = stats.perfect | 0;
      resMiss.textContent    = stats.miss | 0;
      resAcc.textContent     = stats.accuracy.toFixed(1) + ' %';
      resTime.textContent    = stats.playTime.toFixed(1) + ' s';
      resPid.textContent     = stats.participantId || '-';
    }
  });

  // ---------- events: mode ----------
  btnModeResearch?.addEventListener('click', () => setMode('research'));
  btnModeNormal?.addEventListener('click', () => setMode('normal'));

  // ---------- events: main buttons ----------
  btnStart?.addEventListener('click', () => {
    const diff  = selDiff?.value || 'easy';
    const track = selTrack?.value || 't1';

    lastConfig = {
      mode,
      diff,
      track,
      participantId:  inpPid?.value.trim()   || '',
      participantGrp: inpGroup?.value.trim() || ''
    };

    // set labels
    statMode.textContent  = mode === 'research' ? 'วิจัย' : 'ปกติ';
    statDiff.textContent  = selDiff?.selectedOptions[0]?.textContent || diff;
    statTrack.textContent = selTrack?.selectedOptions[0]?.textContent || 'Track';

    showView('play');

    engine.start({
      mode,
      diff,
      track,
      participantId: lastConfig.participantId,
      participantGrp: lastConfig.participantGrp,
      modeLabel: statMode.textContent,
      diffLabel: statDiff.textContent,
      trackLabel: statTrack.textContent
    });
  });

  btnStop?.addEventListener('click', () => {
    engine.stop('STOP_EARLY');
  });

  btnBack?.addEventListener('click', () => {
    engine.stop('BACK_MENU');
    showView('menu');
  });

  btnPlayAgain?.addEventListener('click', () => {
    if (!lastConfig) {
      showView('menu');
      return;
    }
    showView('play');
    engine.start({
      ...lastConfig,
      modeLabel: lastConfig.mode === 'research' ? 'วิจัย' : 'ปกติ',
      diffLabel: selDiff?.selectedOptions[0]?.textContent || lastConfig.diff,
      trackLabel: selTrack?.selectedOptions[0]?.textContent || 'Track'
    });
  });
});
