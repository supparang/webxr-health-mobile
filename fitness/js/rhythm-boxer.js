// === Rhythm Boxer entry — rhythm-boxer.js ===
import { initRhythmEngine } from './rhythm-engine.js';

window.addEventListener('DOMContentLoaded', () => {
  const viewMenu   = document.getElementById('view-menu');
  const viewPlay   = document.getElementById('view-play');
  const viewResult = document.getElementById('view-result');

  const difficulty   = document.getElementById('difficulty');
  const trackSelect  = document.getElementById('track-select');
  const researchId   = document.getElementById('research-id');
  const researchGrp  = document.getElementById('research-group');

  let mode = 'normal'; // 'research' | 'normal'
  let engine = null;

  // mode buttons
  document.querySelector('[data-action="mode-research"]').addEventListener('click', () => {
    mode = 'research';
  });
  document.querySelector('[data-action="mode-normal"]').addEventListener('click', () => {
    mode = 'normal';
  });

  // Begin play
  document.querySelector('[data-action="begin-play"]').addEventListener('click', () => {
    const diff  = difficulty.value;
    const track = trackSelect.value;

    const cfg = {
      mode,
      diff,
      track,
      participantId: (mode === 'research') ? researchId.value.trim() : '',
      group: (mode === 'research') ? researchGrp.value.trim() : ''
    };

    viewMenu.classList.add('hidden');
    viewResult.classList.add('hidden');
    viewPlay.classList.remove('hidden');

    // init engine
    if (engine && typeof engine.dispose === 'function') {
      engine.dispose();
    }
    engine = initRhythmEngine(cfg, {
      onFinished: (summary) => {
        // fill result view
        document.getElementById('res-mode').textContent   = summary.modeLabel;
        document.getElementById('res-diff').textContent   = summary.diffLabel;
        document.getElementById('res-track').textContent  = summary.trackLabel;
        document.getElementById('res-score').textContent  = summary.score;
        document.getElementById('res-maxcombo').textContent = summary.maxCombo;
        document.getElementById('res-perfect').textContent  = summary.perfect;
        document.getElementById('res-miss').textContent     = summary.miss;
        document.getElementById('res-fever').textContent    = summary.feverPercent.toFixed(1) + '%';

        viewPlay.classList.add('hidden');
        viewResult.classList.remove('hidden');
      }
    });
  });

  // Back buttons
  document.querySelectorAll('[data-action="back-to-menu"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (engine && typeof engine.dispose === 'function') engine.dispose();
      viewPlay.classList.add('hidden');
      viewResult.classList.add('hidden');
      viewMenu.classList.remove('hidden');
    });
  });

  // Play again
  const btnAgain = document.querySelector('[data-action="play-again"]');
  if (btnAgain) {
    btnAgain.addEventListener('click', () => {
      viewResult.classList.add('hidden');
      viewMenu.classList.remove('hidden');
    });
  }
});
