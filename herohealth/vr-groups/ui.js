// === /herohealth/vr-groups/ui.js (2025-12-05 Production Ready) ===
// UI ของ Food Groups VR – คะแนน, Quest HUD, Coach Bubble และ End Summary
// ออกแบบให้ทำงานได้ทั้งกรณีมี HUD ครบ และกรณีไม่มี element เหล่านั้น (จะไม่ error แค่ไม่แสดง)

(function (ns) {
  'use strict';

  const UI = {};

  // ---------------------------------------------------------------
  // Lazy query DOM (กันกรณีโหลด script ก่อน HTML)
  // ---------------------------------------------------------------
  let domCache = null;
  function getDom() {
    if (domCache) return domCache;
    domCache = {
      score:       document.getElementById('hud-score'),
      questMain:   document.getElementById('hud-quest-main'),
      questMini:   document.getElementById('hud-quest-mini'),
      mainBar:     document.getElementById('hud-quest-main-bar'),
      miniBar:     document.getElementById('hud-quest-mini-bar'),
      mainCap:     document.getElementById('hud-quest-main-caption'),
      miniCap:     document.getElementById('hud-quest-mini-caption'),
      questHint:   document.getElementById('hud-quest-hint'),
      coach:       document.getElementById('coach-bubble'),
      coachText:   document.getElementById('coach-text'),
      endToast:    document.getElementById('end-toast'),
      endScore:    document.getElementById('end-score'),
      endQuest:    document.getElementById('end-quest')
    };
    return domCache;
  }

  // ---------------------------------------------------------------
  // ฟังก์ชันที่ GameEngine เรียกตอนเริ่มเกม
  // ---------------------------------------------------------------
  /**
   * UI.show({ diff, durationSec })
   * เอาไว้ setup HUD ตอนเริ่มเกม (ถ้าไม่มี HUD จะเป็น no-op)
   */
  UI.show = function (opts) {
    const d = getDom();
    // ถ้าไม่มี HUD เลย ก็ไม่ต้องทำอะไร
    if (!d.score) return;

    d.score.textContent = '0';

    // เผื่อในอนาคตถ้ามี label diff/time บน HUD
    const elDiff = document.getElementById('hud-diff-label');
    const elTime = document.getElementById('hud-time-label');
    if (elDiff && opts && opts.diff) {
      elDiff.textContent = String(opts.diff).toUpperCase();
    }
    if (elTime && opts && typeof opts.durationSec === 'number') {
      elTime.textContent = opts.durationSec + 's';
    }
  };

  // ---------------------------------------------------------------
  // คะแนน
  // ---------------------------------------------------------------
  UI.setScore = function (v) {
    const d = getDom();
    if (d.score) d.score.textContent = v;
  };

  // ---------------------------------------------------------------
  // Coach Bubble
  // ---------------------------------------------------------------
  let coachTimer = null;

  UI.setCoach = function (text) {
    const d = getDom();
    if (!d.coach || !d.coachText) return;

    d.coachText.textContent = text;
    d.coach.classList.add('show');

    if (coachTimer) clearTimeout(coachTimer);
    coachTimer = setTimeout(() => {
      d.coach.classList.remove('show');
    }, 3500);
  };

  // ---------------------------------------------------------------
  // Quest HUD – goal + mini quest
  // ---------------------------------------------------------------
  UI.updateQuest = function (payload) {
    if (!payload) return;
    const d = getDom();

    // ถ้าไม่มี element พวก quest-* ก็ไม่ต้องแสดง แต่ไม่ error
    const hasGoalEls = d.questMain && d.mainBar && d.mainCap;
    const hasMiniEls = d.questMini && d.miniBar && d.miniCap;

    // ===== Goal =====
    if (hasGoalEls) {
      if (payload.goal) {
        const g = payload.goal;
        d.questMain.textContent = g.label || 'Goal';
        const pct = g.target > 0 ? (g.prog / g.target) * 100 : 0;
        d.mainBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
        d.mainCap.textContent = `${g.prog} / ${g.target}`;
      } else {
        d.questMain.textContent = 'Goal สำเร็จแล้ว 🎉';
        d.mainBar.style.width = '100%';
        d.mainCap.textContent = '';
      }
    }

    // ===== Mini Quest =====
    if (hasMiniEls) {
      if (payload.mini) {
        const m = payload.mini;
        d.questMini.textContent = 'Mini: ' + (m.label || '');
        const pct2 = m.target > 0 ? (m.prog / m.target) * 100 : 0;
        d.miniBar.style.width = Math.min(100, Math.max(0, pct2)) + '%';
        d.miniCap.textContent = `${m.prog} / ${m.target}`;
      } else {
        d.questMini.textContent = 'Mini quest สำเร็จ 🎯';
        d.miniBar.style.width = '100%';
        d.miniCap.textContent = '';
      }
    }

    if (payload.hint && d.questHint) {
      d.questHint.textContent = payload.hint;
    }
  };

  // ---------------------------------------------------------------
  // สรุปผลตอนจบเกม
  // ---------------------------------------------------------------
  UI.showEnd = function (score, cleared, total) {
    const d = getDom();
    if (!d.endToast || !d.endScore || !d.endQuest) return;

    d.endScore.textContent = score;
    d.endQuest.textContent = `${cleared} / ${total}`;
    d.endToast.classList.add('show');
  };

  // ---------------------------------------------------------------
  // Event bridge จาก GameEngine / Quest Manager
  // ---------------------------------------------------------------
  window.addEventListener('quest:update', (e) => {
    UI.updateQuest(e.detail);
  });

  window.addEventListener('hha:coach', (e) => {
    const text = e.detail && e.detail.text;
    if (text) UI.setCoach(text);
  });

  // ---------------------------------------------------------------
  ns.foodGroupsUI = UI;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
