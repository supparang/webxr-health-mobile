// vr-groups/launcher-groups.js
// จัดการปุ่มเมนู, เริ่มเกม, จบเกม, สรุปผล, ปุ่มเสียง, ปุ่มออกเกม

(function (ns) {
  'use strict';

  function setup() {
    const sceneEl        = document.querySelector('a-scene');
    const uiOverlay      = document.getElementById('uiOverlay');
    const startScreen    = document.getElementById('startScreen');
    const resultsScreen  = document.getElementById('resultsScreen');
    const finalScoreEl   = document.getElementById('finalScore');
    const fgSummaryEl    = document.getElementById('fgSummary');
    const fgOverallNote  = document.getElementById('fgOverallNote');

    const btnEasy   = document.getElementById('startButtonEasy');
    const btnNormal = document.getElementById('startButtonNormal');
    const btnHard   = document.getElementById('startButtonHard');
    const btnAgain  = document.getElementById('playAgainButton');

    const exitBtn   = document.getElementById('fgExitButton');
    const soundBtn  = document.getElementById('fgSoundToggle');

    if (!sceneEl || !uiOverlay) {
      console.warn('[GroupsVR Launcher] scene or uiOverlay not found');
      return;
    }

    let lastDiff = 'normal';

    function showStart() {
      startScreen.style.display   = 'block';
      resultsScreen.style.display = 'none';
      uiOverlay.classList.remove('hidden');
    }

    function showResults() {
      startScreen.style.display   = 'none';
      resultsScreen.style.display = 'block';
      uiOverlay.classList.remove('hidden');
    }

    function hideOverlay() {
      uiOverlay.classList.add('hidden');
    }

    function startGame(diff) {
      lastDiff = diff || 'normal';
      hideOverlay();
      sceneEl.emit('fg-start', { diff: lastDiff });
    }

    // ----- ปุ่มเริ่มเกม -----
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

    // ----- ปุ่มเล่นอีกครั้ง → กลับหน้าเมนูเลือกความยาก -----
    if (btnAgain) {
      btnAgain.addEventListener('click', function () {
        showStart();
      });
    }

    // ----- ปุ่มออกเกมมุมจอ → หยุดเกม + กลับเมนู -----
    if (exitBtn) {
      exitBtn.addEventListener('click', function () {
        sceneEl.emit('fg-stop', { reason: 'exit' });
        showStart();
      });
    }

    // ----- ปุ่มเสียง -----
    function refreshSoundLabel() {
      if (!soundBtn || !ns.foodGroupsAudio || !ns.foodGroupsAudio.isMuted) return;
      const muted = ns.foodGroupsAudio.isMuted();
      soundBtn.textContent = muted
        ? '🔇 ปิดเสียง (แตะเพื่อเปิด)'
        : '🔊 เปิดเสียง (แตะเพื่อปิด)';
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        if (!ns.foodGroupsAudio || !ns.foodGroupsAudio.setMuted || !ns.foodGroupsAudio.isMuted) {
          return;
        }
        const cur = ns.foodGroupsAudio.isMuted();
        ns.foodGroupsAudio.setMuted(!cur);
        refreshSoundLabel();
      });
      // sync label ตอนโหลด
      refreshSoundLabel();
    }

    // ----- รับ event ตอนเกมจบจาก GameEngine -----
    sceneEl.addEventListener('fg-game-over', function (e) {
      const detail     = e.detail || {};
      const score      = detail.score || 0;
      const diff       = detail.diff || 'normal';
      const groupStats = detail.groupStats || {};

      if (finalScoreEl) {
        finalScoreEl.textContent = 'Score: ' + score + '  (' + diff + ')';
      }

      // สรุปรายหมู่
      if (fgSummaryEl) {
        const rows = [];
        let totalSpawn = 0;
        let totalHit   = 0;

        Object.keys(groupStats).forEach(id => {
          const g = groupStats[id];
          if (!g || !g.spawns) return;
          const sp = g.spawns || 0;
          const ht = g.hits   || 0;
          const pct = sp > 0 ? Math.round((ht / sp) * 100) : 0;

          totalSpawn += sp;
          totalHit   += ht;

          rows.push({
            id,
            text:
              `• หมู่ ${g.id} ${g.emoji || ''} : ยิงโดน ${ht}/${sp} เป้า ` +
              `(${pct}%)`
          });
        });

        rows.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

        fgSummaryEl.innerHTML = rows.length
          ? rows.map(r => r.text).join('<br>')
          : 'ยังไม่เก็บตัวอย่างได้มากพอ ลองเล่นอีกครั้งนะ 😊';

        if (fgOverallNote) {
          if (totalSpawn > 0) {
            const overallPct = Math.round((totalHit / totalSpawn) * 100);
            let msg = `ครั้งนี้เลือกอาหารดีได้ประมาณ <b>${overallPct}%</b> ของทั้งหมด 💚<br>`;
            if (overallPct >= 80) {
              msg += 'เยี่ยมมาก! ลองใช้คะแนนนี้เปรียบเทียบก่อน–หลังการสอนได้เลย ✨';
            } else if (overallPct >= 60) {
              msg += 'ดีมากแล้ว ลองสังเกตหมู่ที่พลาดบ่อย ๆ แล้วเล่นอีกสักรอบ 😊';
            } else {
              msg += 'ยังเลือกพลาดอยู่บ้าง ลองคุยกับครูเรื่องหมู่อาหารแล้วเล่นใหม่อีกครั้งนะ 💪';
            }
            fgOverallNote.innerHTML = msg;
          } else {
            fgOverallNote.innerHTML =
              'ข้อมูลยังน้อยไปหน่อย ลองให้เด็กเล่นอีกรอบเพื่อเก็บข้อมูลเพิ่มนะครับ ✨';
          }
        }
      }

      showResults();
    });

    // เริ่มต้นด้วยหน้าเมนู
    showStart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})(window.GAME_MODULES || (window.GAME_MODULES = {}));