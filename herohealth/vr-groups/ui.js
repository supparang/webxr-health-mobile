// === vr-groups/ui.js (2025-12-03 Production Ready) ===
// UI ของ Food Groups VR – คะแนน, Quest HUD, และ Coach Bubble

(function (ns) {
  'use strict';

  const UI = {};

  // -------------------------------------------------------------------
  // SELECTOR ของ HUD (จับ DOM ที่ groups-vr.html มีอยู่แล้ว)
  // -------------------------------------------------------------------
  const elScore     = document.getElementById('hud-score');
  const elQuestMain = document.getElementById('hud-quest-main');
  const elQuestMini = document.getElementById('hud-quest-mini');
  const elMainBar   = document.getElementById('hud-quest-main-bar');
  const elMiniBar   = document.getElementById('hud-quest-mini-bar');
  const elMainCap   = document.getElementById('hud-quest-main-caption');
  const elMiniCap   = document.getElementById('hud-quest-mini-caption');
  const elCoach     = document.getElementById('coach-bubble');
  const elCoachText = document.getElementById('coach-text');

  // -------------------------------------------------------------------
  // คะแนน
  // -------------------------------------------------------------------
  UI.setScore = function (v) {
    if (elScore) elScore.textContent = v;
  };

  // -------------------------------------------------------------------
  // Coach Bubble
  // -------------------------------------------------------------------
  let coachTimer = null;

  UI.setCoach = function (text) {
    if (!elCoach || !elCoachText) return;
    elCoachText.textContent = text;
    elCoach.classList.add('show');

    if (coachTimer) clearTimeout(coachTimer);
    coachTimer = setTimeout(() => {
      elCoach.classList.remove('show');
    }, 3500);
  };

  // -------------------------------------------------------------------
  // Quest HUD – goal + mini quest
  // รับ event จาก quest-manager.js → GameEngine.js → ui.js
  // -------------------------------------------------------------------
  UI.updateQuest = function (d) {
    if (!d) return;

    // ===== Goal =====
    if (d.goal) {
      const g = d.goal;
      elQuestMain.textContent = g.label || 'Goal';
      const pct = g.target > 0 ? (g.prog / g.target) * 100 : 0;
      elMainBar.style.width = Math.min(100, pct) + '%';
      elMainCap.textContent = `${g.prog} / ${g.target}`;
    } else {
      // goal เคลียร์แล้ว
      elQuestMain.textContent = 'Goal สำเร็จแล้ว 🎉';
      elMainBar.style.width = '100%';
      elMainCap.textContent = '';
    }

    // ===== Mini Quest =====
    if (d.mini) {
      const m = d.mini;
      elQuestMini.textContent = 'Mini: ' + (m.label || '');
      const pct = m.target > 0 ? (m.prog / m.target) * 100 : 0;
      elMiniBar.style.width = Math.min(100, pct) + '%';
      elMiniCap.textContent = `${m.prog} / ${m.target}`;
    } else {
      elQuestMini.textContent = 'Mini quest สำเร็จ 🎯';
      elMiniBar.style.width = '100%';
      elMiniCap.textContent = '';
    }

    // hint ถ้ามี
    if (d.hint) {
      const hint = document.getElementById('hud-quest-hint');
      if (hint) hint.textContent = d.hint;
    }
  };

  // -------------------------------------------------------------------
  // สรุปผลตอนจบเกม (GameEngine.js เรียก)
  // -------------------------------------------------------------------
  UI.showEnd = function (score, cleared, total) {
    const elToast = document.getElementById('end-toast');
    const elScore2 = document.getElementById('end-score');
    const elQuest2 = document.getElementById('end-quest');

    if (!elToast) return;

    elScore2.textContent = score;
    elQuest2.textContent = `${cleared} / ${total}`;

    elToast.classList.add('show');
  };

  // -------------------------------------------------------------------
  // EVENT LISTENERS จาก GameEngine / Quest Manager
  // -------------------------------------------------------------------
  window.addEventListener('quest:update', e => {
    UI.updateQuest(e.detail);
  });

  window.addEventListener('hha:coach', e => {
    const text = e.detail?.text || '';
    if (text) UI.setCoach(text);
  });

  // -------------------------------------------------------------------
  ns.foodGroupsUI = UI;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));