// vr-groups/launcher-groups.js
// จัดการปุ่มเมนู → สั่งเริ่มเกม / จบเกม และแสดงผลลัพธ์

(function () {
  'use strict';

  // ---------- helper DOM ----------
  function $(id) {
    return document.getElementById(id);
  }

  function getScene() {
    return document.querySelector('a-scene');
  }

  const overlay      = $('uiOverlay');      // ครอบเมนู + results
  const startScreen  = $('startScreen');
  const resultsScreen = $('resultsScreen');
  const btnEasy      = $('startButtonEasy');
  const btnNormal    = $('startButtonNormal');
  const btnHard      = $('startButtonHard');
  const btnPlayAgain = $('playAgainButton');
  const finalScoreEl = $('finalScore');
  const summaryEl    = $('fgSummary');
  const hintEl       = $('fgHint');

  let lastDiff = 'normal';

  // ---------- แสดงเมนูเริ่มเกม ----------
  function showMenu() {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    if (startScreen)  startScreen.style.display  = 'block';
    if (resultsScreen) resultsScreen.style.display = 'none';
    if (hintEl) hintEl.style.display = 'block';
  }

  // ---------- แสดงหน้าสรุป ----------
  function showResults(detail) {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    if (startScreen)  startScreen.style.display  = 'none';
    if (resultsScreen) resultsScreen.style.display = 'block';
    if (hintEl) hintEl.style.display = 'none';

    if (finalScoreEl && detail) {
      finalScoreEl.textContent = 'Score: ' + (detail.score || 0);
    }

    // สรุปผลรายหมู่ถ้ามี groupStats
    if (summaryEl) {
      let html = '';
      const stats = detail && detail.groupStats;
      if (stats) {
        html += '<b>สรุปการเก็บอาหารแต่ละหมู่</b><br/>';
        const keys = Object.keys(stats).sort(function (a, b) {
          return Number(a) - Number(b);
        });
        keys.forEach(function (k) {
          const g = stats[k];
          if (!g) return;
          const label = g.label || ('หมู่ ' + g.id);
          const spawns = g.spawns || 0;
          const hits   = g.hits || 0;
          const rate   = spawns > 0 ? Math.round((hits / spawns) * 100) : 0;
          html += '• ' + label +
                  ' : ถูกยิงโดน ' + hits + '/' + spawns +
                  ' เป้า (' + rate + '%)<br/>';
        });
      } else {
        html = 'ยังไม่มีข้อมูลรายหมู่';
      }
      summaryEl.innerHTML = html;
    }
  }
const noteEl = document.getElementById('fgOverallNote');
if (noteEl && data && data.groupStats) {
  let totalHits = 0;
  let totalSpawns = 0;
  Object.values(data.groupStats).forEach(g => {
    totalHits += g.hits || 0;
    totalSpawns += g.spawns || 0;
  });
  const pct = totalSpawns > 0 ? Math.round((totalHits / totalSpawns) * 100) : 0;
  noteEl.innerHTML =
    'ครั้งนี้เลือกอาหารดีได้ <b>' + pct +
    '%</b> ของทั้งหมด 💚<br>ลองเล่นใหม่อีกครั้ง เพื่อเก็บคะแนนให้สูงขึ้นหรือใช้เปรียบเทียบก่อน–หลังการสอนได้เลย!';
}

  // ---------- สั่งเริ่มเกม ----------
  function startGame(diff) {
    lastDiff = diff || 'normal';

    const sceneEl = getScene();
    if (!sceneEl) {
      console.warn('[GroupsVR] cannot find <a-scene> to start game');
      return;
    }

    if (overlay) overlay.classList.add('hidden');
    if (hintEl) hintEl.style.display = 'none';

    sceneEl.emit('fg-start', { diff: lastDiff });
  }

  // ---------- hook ปุ่ม ----------
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
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', function () {
      showMenu();
    });
  }

  // ---------- รับ event จาก GameEngine ----------
  document.addEventListener('DOMContentLoaded', function () {
    const sceneEl = getScene();
    if (!sceneEl) return;

    sceneEl.addEventListener('fg-game-over', function (e) {
      const detail = e.detail || {};
      showResults(detail);
    });
  });

  // แสดงเมนูครั้งแรก
  if (overlay && startScreen) {
    showMenu();
  }

})();
