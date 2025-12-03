// === /herohealth/vr-groups/ui.js ===
// UI controller สำหรับ Food Groups VR (Score + Time + Quest HUD)
// Production Ready (2025-12-05)

(function (ns) {
  'use strict';

  const UI = {};

  // DOM refs
  let elScore, elTime;
  let elQuestMain, elQuestMini;
  let elQuestMainBar, elQuestMiniBar;
  let elQuestMainCap, elQuestMiniCap, elQuestHint;

  //--------------------------------------------------------------------
  // init UI – เรียกจาก GameEngine.start()
  //--------------------------------------------------------------------
  UI.attachScene = function () {
    elScore        = document.getElementById('hud-score');
    elTime         = document.getElementById('hud-time-label');

    elQuestMain    = document.getElementById('hud-quest-main');
    elQuestMini    = document.getElementById('hud-quest-mini');

    elQuestMainBar = document.getElementById('hud-quest-main-bar');
    elQuestMiniBar = document.getElementById('hud-quest-mini-bar');

    elQuestMainCap = document.getElementById('hud-quest-main-caption');
    elQuestMiniCap = document.getElementById('hud-quest-mini-caption');

    elQuestHint    = document.getElementById('hud-quest-hint');
  };

  UI.init = function () {
    if (!elScore) UI.attachScene();

    elScore.textContent = '0';
    elTime.textContent  = '60s';

    // reset quest HUD
    elQuestMain.textContent = 'ภารกิจหลักกำลังเริ่ม…';
    elQuestMini.textContent = 'Mini quest กำลังเริ่ม…';

    elQuestMainBar.style.width = '0%';
    elQuestMiniBar.style.width = '0%';

    elQuestMainCap.textContent = '0 / 0';
    elQuestMiniCap.textContent = '0 / 0';

    if (elQuestHint) elQuestHint.textContent = '';
  };

  //--------------------------------------------------------------------
  // เวลา (ถูกเรียกจาก GameEngine ผ่าน event)
  //--------------------------------------------------------------------
  UI.setTime = function (sec) {
    if (!elTime) return;
    elTime.textContent = sec + 's';
  };

  //--------------------------------------------------------------------
  // คะแนน
  //--------------------------------------------------------------------
  UI.setScore = function (score) {
    if (!elScore) return;
    elScore.textContent = String(score);
  };

  //--------------------------------------------------------------------
  // Effect ตอนยิงโดน / พลาด
  //--------------------------------------------------------------------
  UI.flashJudgment = function (opts) {
    const {
      isMiss,
      scoreDelta,
      judgment
    } = opts || {};

    // ส่ง event ไป HUD ระดับบนสุด (goodjunk style)
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        scoreDelta,
        judgment
      }
    }));

    if (isMiss) {
      window.dispatchEvent(new CustomEvent('hha:miss'));
    }
  };

  //--------------------------------------------------------------------
  // Quest HUD (รับ event จาก quest-manager.js)
  //--------------------------------------------------------------------
  UI.update = function (status, quest, justFinished) {
    if (!quest) return;

    // goal + mini
    const goal = status?.goal || quest.goal;
    const mini = status?.mini || quest.mini;

    //----------------------------------------------------------------
    // Goal
    //----------------------------------------------------------------
    if (quest.goal) {
      elQuestMain.textContent = quest.goal.label;
      const prog  = quest.goal.prog | 0;
      const tgt   = quest.goal.target | 0;
      const pct   = tgt > 0 ? (prog / tgt) * 100 : 0;

      elQuestMainBar.style.width = pct + '%';
      elQuestMainCap.textContent = `${prog} / ${tgt}`;
    } else {
      elQuestMain.textContent = 'ภารกิจหลักครบแล้ว 🎉';
      elQuestMainBar.style.width = '100%';
      elQuestMainCap.textContent = '';
    }

    //----------------------------------------------------------------
    // Mini Quest
    //----------------------------------------------------------------
    if (quest.mini) {
      elQuestMini.textContent = 'Mini: ' + quest.mini.label;
      const progM = quest.mini.prog | 0;
      const tgtM  = quest.mini.count || quest.mini.target || 0;
      const pctM  = tgtM > 0 ? (progM / tgtM) * 100 : 0;

      elQuestMiniBar.style.width = pctM + '%';
      elQuestMiniCap.textContent = `${progM} / ${tgtM}`;
    } else {
      elQuestMini.textContent = 'Mini quest ครบแล้ว ✓';
      elQuestMiniBar.style.width = '100%';
      elQuestMiniCap.textContent = '';
    }

    //----------------------------------------------------------------
    // hint
    //----------------------------------------------------------------
    if (quest.hint && elQuestHint) {
      elQuestHint.textContent = quest.hint;
    }
  };

  //--------------------------------------------------------------------
  // End game UI
  //--------------------------------------------------------------------
  UI.hide = function () {
    // ถ้าอยาก fade out ก็เพิ่มได้
  };

  UI.show = function () {
    // ไม่ต้องทำอะไร HUD เป็น fixed overlay อยู่แล้ว
  };

  //--------------------------------------------------------------------
  // ผูกเข้าระบบ global
  //--------------------------------------------------------------------
  ns.foodGroupsUI = UI;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));