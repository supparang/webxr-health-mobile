// vr-groups/launcher-groups.js
(function () {
  'use strict';

  const sceneEl       = document.querySelector('#gameScene');
  const uiOverlay     = document.getElementById('uiOverlay');
  const startScreen   = document.getElementById('startScreen');
  const resultsScreen = document.getElementById('resultsScreen');
  const finalScoreEl  = document.getElementById('finalScore');
  const summaryEl     = document.getElementById('fgSummary');
  const noteEl        = document.getElementById('fgOverallNote');

  const btnEasy   = document.getElementById('startButtonEasy');
  const btnNormal = document.getElementById('startButtonNormal');
  const btnHard   = document.getElementById('startButtonHard');
  const btnAgain  = document.getElementById('playAgainButton');

  function startGame(diff) {
    if (!sceneEl) return;
    // ซ่อน overlay แล้วเริ่มเกม
    if (uiOverlay) uiOverlay.classList.add('hidden');
    if (resultsScreen) resultsScreen.style.display = 'none';
    if (startScreen)   startScreen.style.display   = 'none';

    sceneEl.emit('fg-start', { diff: diff }, false);
  }

  if (btnEasy) {
    btnEasy.addEventListener('click', function () {
      startGame('easy');
    });
  }
  if (btnNormal) {
    btnNormal.addEventListener('click', function () {
      startGame('normal');
    });
  }
  if (btnHard) {
    btnHard.addEventListener('click', function () {
      startGame('hard');
    });
  }

  if (btnAgain) {
    btnAgain.addEventListener('click', function () {
      // กลับมาหน้าเลือกโหมด
      if (resultsScreen) resultsScreen.style.display = 'none';
      if (startScreen)   startScreen.style.display   = 'block';
    });
  }

  // ----- จบเกม → สรุปผล + แสดง overlay -----
  if (sceneEl) {
    sceneEl.addEventListener('fg-game-over', function (evt) {
      const detail = (evt && evt.detail) || {};

      const score        = detail.score || 0;
      const groupStats   = detail.groupStats || {};
      const questsCleared = detail.questsCleared || 0;

      // show overlay
      if (uiOverlay) uiOverlay.classList.remove('hidden');
      if (startScreen)   startScreen.style.display   = 'none';
      if (resultsScreen) resultsScreen.style.display = 'block';

      if (finalScoreEl) {
        finalScoreEl.textContent = 'Score: ' + score;
      }

      // ---- สรุปตามหมู่ ----
      if (summaryEl) {
        const lines = [];
        Object.keys(groupStats).forEach(function (k) {
          const g = groupStats[k] || {};
          const spawns = g.spawns || 0;
          const hits   = g.hits   || 0;
          const pct    = spawns > 0 ? Math.round((hits / spawns) * 100) : 0;
          const emoji  = g.emoji || '';
          const label  = g.label || ('หมู่ ' + k);
          lines.push(
            '• ' + emoji + ' ' + label + ' : ยิงโดน ' +
            hits + '/' + spawns + ' เป้า (' + pct + '%)'
          );
        });

        if (!lines.length) {
          lines.push('ยังไม่มีข้อมูลการยิงเป้าในรอบนี้');
        }

        summaryEl.innerHTML = lines.join('<br>');
      }

      // ---- สรุปเปอร์เซ็นต์รวม (note ด้านล่าง) ----
      if (noteEl) {
        let totalHits   = 0;
        let totalSpawns = 0;
        Object.values(groupStats).forEach(function (g) {
          totalHits   += g.hits   || 0;
          totalSpawns += g.spawns || 0;
        });
        const pct = totalSpawns > 0 ? Math.round((totalHits / totalSpawns) * 100) : 0;

        noteEl.innerHTML =
          'ครั้งนี้เลือกอาหารดีได้ <b>' + pct +
          '%</b> ของทั้งหมด 💚<br>' +
          'สำเร็จภารกิจไปแล้ว <b>' + questsCleared +
          '</b> ภารกิจ ลองเล่นใหม่เพื่อเก็บคะแนนให้สูงขึ้น หรือใช้เปรียบเทียบก่อน–หลังการสอนได้เลย!';
      }
    });
  }
})();
