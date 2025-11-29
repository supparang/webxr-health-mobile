(function (global) {
  'use strict';
  const App = global.GAME_MODULES = global.GAME_MODULES || {};
  const { GameEngine } = App;

  const uiOverlay    = document.getElementById('uiOverlay');
  const startScreen  = document.getElementById('startScreen');
  const resultsScreen= document.getElementById('resultsScreen');
  const finalScore   = document.getElementById('finalScore');
  const playAgainBtn = document.getElementById('playAgainButton');

  const DURATION = 60 * 1000;
  let gameEndTimer = null;

  function endGame(scoreOverride) {
    const finalScoreValue = (typeof scoreOverride === 'number')
      ? scoreOverride
      : window.score;
    GameEngine.stop();
    uiOverlay.classList.remove('hidden');
    startScreen.style.display = 'none';
    resultsScreen.style.display = 'block';
    finalScore.textContent = `คะแนน: ${finalScoreValue}`;
  }

  function startGame(diff) {
    uiOverlay.classList.add('hidden');
    GameEngine.start(diff);
    if (gameEndTimer) clearTimeout(gameEndTimer);
    gameEndTimer = setTimeout(() => endGame(), DURATION);
  }

  document.getElementById('startButtonEasy')
    .addEventListener('click', () => startGame('easy'));
  document.getElementById('startButtonNormal')
    .addEventListener('click', () => startGame('normal'));
  document.getElementById('startButtonHard')
    .addEventListener('click', () => startGame('hard'));

  playAgainBtn.addEventListener('click', () => {
    resultsScreen.style.display = 'none';
    startScreen.style.display = 'block';
  });

  window.addEventListener('hha:end', (ev) => {
    if (gameEndTimer) clearTimeout(gameEndTimer);
    if (!window.running) return; // กันถูกเรียกซ้ำ
    const score = ev.detail && typeof ev.detail.score === 'number'
      ? ev.detail.score : window.score;
    endGame(score);
  });

})(window);
