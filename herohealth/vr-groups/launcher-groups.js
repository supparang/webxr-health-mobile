// vr-goodjunk/launcher-groups.js
(function (ns) {
  'use strict';

  function setup() {
    const uiOverlay = document.getElementById('uiOverlay');
    const startScreen = document.getElementById('startScreen');
    const resultsScreen = document.getElementById('resultsScreen');
    const finalScore = document.getElementById('finalScore');

    const btnEasy = document.getElementById('startButtonEasy');
    const btnNormal = document.getElementById('startButtonNormal');
    const btnHard = document.getElementById('startButtonHard');
    const btnAgain = document.getElementById('playAgainButton');

    const scene = document.getElementById('gameScene');
    if (!scene) return;

    function start(diff) {
      if (startScreen) startScreen.style.display = 'none';
      if (resultsScreen) resultsScreen.style.display = 'none';
      if (uiOverlay) uiOverlay.classList.add('hidden');

      scene.emit('fg-start', { diff: diff });
    }

    if (btnEasy) btnEasy.addEventListener('click', () => start('easy'));
    if (btnNormal) btnNormal.addEventListener('click', () => start('normal'));
    if (btnHard) btnHard.addEventListener('click', () => start('hard'));

    if (btnAgain) {
      btnAgain.addEventListener('click', () => {
        if (resultsScreen) resultsScreen.style.display = 'none';
        if (startScreen) startScreen.style.display = 'block';
      });
    }

    scene.addEventListener('fg-game-over', function (e) {
      const detail = e.detail || {};
      const score = detail.score || 0;
      const quests = detail.questsCleared != null ? detail.questsCleared : 0;

      if (finalScore) {
        finalScore.textContent =
          `คะแนน: ${score} (เคลียร์ภารกิจ ${quests} ขั้น)`;
      }

      if (uiOverlay) uiOverlay.classList.remove('hidden');
      if (startScreen) startScreen.style.display = 'none';
      if (resultsScreen) resultsScreen.style.display = 'block';
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  ns.foodGroupsLauncher = { setup };
})(window.GAME_MODULES);
