// vr-groups/launcher-groups.js
(function (ns) {
  'use strict';

  function parseUrlConfig() {
    const url = new URL(window.location.href);
    const q = url.searchParams;
    const diffParam = (q.get('diff') || '').toLowerCase();
    const autoStart = q.get('autostart') === '1';
    return {
      playerName: q.get('name') || '',
      playerClass: q.get('class') || '',
      sessionId: q.get('sid') || '',
      diffParam: ['easy', 'normal', 'hard'].includes(diffParam) ? diffParam : '',
      autoStart: autoStart
    };
  }

  function setup() {
    const uiOverlay    = document.getElementById('uiOverlay');
    const startScreen  = document.getElementById('startScreen');
    const resultsScreen = document.getElementById('resultsScreen');
    const finalScore   = document.getElementById('finalScore');
    const summaryEl    = document.getElementById('fgSummary');
    const hintEl       = document.getElementById('fgHint');

    const btnEasy   = document.getElementById('startButtonEasy');
    const btnNormal = document.getElementById('startButtonNormal');
    const btnHard   = document.getElementById('startButtonHard');
    const btnAgain  = document.getElementById('playAgainButton');

    const scene = document.getElementById('gameScene');
    if (!scene) return;

    // ----- อ่าน config จาก URL แล้วเก็บใน namespace กลาง -----
    const urlCfg = parseUrlConfig();
    ns.foodGroupsSession = {
      playerName: urlCfg.playerName,
      playerClass: urlCfg.playerClass,
      sessionId: urlCfg.sessionId,
      rawParams: urlCfg
    };

    // ไฮไลต์ปุ่มตาม diff ที่ส่งมา (ถ้ามี)
    if (urlCfg.diffParam) {
      const map = { easy: btnEasy, normal: btnNormal, hard: btnHard };
      const b = map[urlCfg.diffParam];
      if (b) {
        b.style.outline = '3px solid #fde047';
        b.style.outlineOffset = '2px';
      }
    }

    function hideHintLater() {
      if (!hintEl) return;
      setTimeout(() => {
        hintEl.style.opacity = '0';
        hintEl.style.pointerEvents = 'none';
      }, 8000);
    }

    function start(diff) {
      if (startScreen) startScreen.style.display = 'none';
      if (resultsScreen) resultsScreen.style.display = 'none';
      if (uiOverlay) uiOverlay.classList.add('hidden');

      hideHintLater();

      scene.emit('fg-start', { diff: diff });
    }

    if (btnEasy)   btnEasy.addEventListener('click', () => start('easy'));
    if (btnNormal) btnNormal.addEventListener('click', () => start('normal'));
    if (btnHard)   btnHard.addEventListener('click', () => start('hard'));

    if (btnAgain) {
      btnAgain.addEventListener('click', () => {
        if (resultsScreen) resultsScreen.style.display = 'none';
        if (startScreen) startScreen.style.display = 'block';
      });
    }

    scene.addEventListener('fg-game-over', function (e) {
      const detail = e.detail || {};
      const score  = detail.score || 0;
      const diff   = detail.diff || 'normal';
      const quests = detail.questsCleared != null ? detail.questsCleared : 0;
      const groupStats = detail.groupStats || null;

      if (finalScore) {
        finalScore.textContent =
          `คะแนนรวม: ${score} (ระดับ: ${diff}, เคลียร์ภารกิจ ${quests}/5 ขั้น)`;
      }

      if (summaryEl) {
        let html = '';

        if (groupStats) {
          const allGroups = (ns.foodGroupsEmoji && ns.foodGroupsEmoji.all)
            ? ns.foodGroupsEmoji.all.slice()
            : [];

          html += '<div>สถิติรายหมู่:</div><ul style="padding-left:18px;margin:4px 0 0;">';

          allGroups.forEach(g => {
            const st = groupStats[g.id] || { spawns: 0, hits: 0 };
            const spawns = st.spawns || 0;
            const hits   = st.hits || 0;
            const acc = spawns > 0 ? Math.round((hits / spawns) * 100) : 0;

            html += `<li>
              ${g.emoji} ${g.label} — ยิงโดน ${hits}/${spawns} เป้า
              (${acc}%)
            </li>`;
          });

          html += '</ul>';
        } else {
          html = '<div>ไม่มีข้อมูลสถิติรายหมู่</div>';
        }

        summaryEl.innerHTML = html;
      }

      if (uiOverlay) uiOverlay.classList.remove('hidden');
      if (startScreen) startScreen.style.display = 'none';
      if (resultsScreen) resultsScreen.style.display = 'block';
    });

    // ----- auto-start ถ้า URL ระบุ autostart=1 & diff=... -----
    if (urlCfg.autoStart && urlCfg.diffParam) {
      start(urlCfg.diffParam);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  ns.foodGroupsLauncher = { setup: setup };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
