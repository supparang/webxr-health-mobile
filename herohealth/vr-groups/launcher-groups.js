// vr-groups/launcher-groups.js
(function (ns) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const sceneEl = document.querySelector('#gameScene');
    const overlay = document.getElementById('uiOverlay');
    const startScreen = document.getElementById('startScreen');
    const resultsScreen = document.getElementById('resultsScreen');
    const finalScoreEl = document.getElementById('finalScore');
    const summaryEl = document.getElementById('fgSummary');
    const playAgainBtn = document.getElementById('playAgainButton');

    function startGame(diff) {
      // แจ้งโค้ชเรื่องความยาก
      if (ns.foodGroupsCoach && ns.foodGroupsCoach.setDifficulty) {
        ns.foodGroupsCoach.setDifficulty(diff);
      }

      // ซ่อนหน้าเมนู
      startScreen.style.display = 'none';
      resultsScreen.style.display = 'none';
      overlay.classList.add('hidden');

      // ส่ง event ให้ GameEngine เริ่ม
      sceneEl.emit('fg-start', { diff: diff });
    }

    document.getElementById('startButtonEasy')
      .addEventListener('click', () => startGame('easy'));
    document.getElementById('startButtonNormal')
      .addEventListener('click', () => startGame('normal'));
    document.getElementById('startButtonHard')
      .addEventListener('click', () => startGame('hard'));

    // ตอนเกมจบ GameEngine จะ emit 'fg-game-over'
    sceneEl.addEventListener('fg-game-over', function (e) {
      const data = e.detail || {};
      const groupStats = data.groupStats || {};

      let html = '';
      const labels = {
        1: 'หมู่ 1 ข้าว-แป้ง',
        2: 'หมู่ 2 เนื้อ-โปรตีน',
        3: 'หมู่ 3 ผัก',
        4: 'หมู่ 4 ผลไม้',
        5: 'หมู่ 5 นม-ผลิตภัณฑ์นม'
      };

      Object.keys(groupStats).forEach(id => {
        const g = groupStats[id];
        if (!g) return;
        const total = g.spawns || 0;
        const hit   = g.hits   || 0;
        const pct   = total > 0 ? Math.round((hit / total) * 100) : 0;
        const label = labels[g.id] || `หมู่ ${g.id}`;

        html += `• ${label} : ถูกยิงโดน ${hit}/${total} เป้า (${pct}%)<br>`;
      });

      finalScoreEl.textContent = `Score: ${data.score || 0}`;
      summaryEl.innerHTML = html || 'ยังไม่มีข้อมูลการยิงในรอบนี้';

      overlay.classList.remove('hidden');
      startScreen.style.display = 'none';
      resultsScreen.style.display = 'block';
    });

    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        overlay.classList.remove('hidden');
        startScreen.style.display = 'block';
        resultsScreen.style.display = 'none';
      });
    }
  });

})(window.GAME_MODULES || (window.GAME_MODULES = {}));