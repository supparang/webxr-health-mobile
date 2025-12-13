// === /herohealth/hydration-vr/hydration.state.js ===
// จัดการ HUD + หน้าสรุป สำหรับ Hydration Quest VR
// ให้ตัวเลข Goals / Mini quests ในหน้าสรุปตรงกับแถบ QUEST เสมอ

'use strict';

(function () {
  const ROOT = window;

  // -----------------------------
  //  Grade helper แบบง่าย ๆ
  // -----------------------------
  function calcGrade(score, miss) {
    score = Number(score) || 0;
    miss = Number(miss) || 0;

    if (score >= 6000 && miss === 0) return 'SSS';
    if (score >= 4000 && miss <= 2) return 'SS';
    if (score >= 2500 && miss <= 4) return 'S';
    if (score >= 1500) return 'A';
    if (score >= 800) return 'B';
    return 'C';
  }

  function formatFraction(done, total) {
    done = Number(done) || 0;
    total = Number(total) || 0;
    if (total <= 0) total = done || 1;
    return `${done} / ${total}`;
  }

  // -----------------------------
  //  แสดงหน้าสรุปผล
  // -----------------------------
  function showResultModal(summary) {
    const modal = document.querySelector('[data-hh-modal="result"]');
    if (!modal) return;

    const q = (sel) => modal.querySelector(sel);

    const elMode   = q('[data-hh-res-mode]');
    const elGrade  = q('[data-hh-res-grade]');
    const elScore  = q('[data-hh-res-score]');
    const elCombo  = q('[data-hh-res-combo]');
    const elMiss   = q('[data-hh-res-miss]');
    const elGoals  = q('[data-hh-res-goals]');
    const elMinis  = q('[data-hh-res-minis]');

    if (elMode)  elMode.textContent  = summary.mode || 'Hydration';
    if (elGrade) elGrade.textContent = summary.grade || 'S';
    if (elScore) elScore.textContent = String(summary.totalScore || 0);
    if (elCombo) elCombo.textContent = String(summary.bestCombo || 0);
    if (elMiss)  elMiss.textContent  = String(summary.miss || 0);

    if (elGoals) {
      elGoals.textContent = formatFraction(
        summary.goalsCleared,
        summary.goalsTarget
      );
    }
    if (elMinis) {
      elMinis.textContent = formatFraction(
        summary.minisCleared,
        summary.minisTarget
      );
    }

    modal.classList.add('is-open');
  }

  // =====================================================
  //  1) ฟัง event hha:end  (เวอร์ชันหลักจาก hydration.safe.js)
  // =====================================================
  ROOT.addEventListener('hha:end', (ev) => {
    const d = ev.detail || {};

    const modeLabel = d.modeLabel || 'Hydration Quest VR';

    const grade = (typeof d.grade === 'string' && d.grade)
      ? d.grade
      : calcGrade(d.score || 0, d.misses || 0);

    // ----- อ่านค่าจำนวนภารกิจจาก detail -----
    // พยายามรองรับทั้งชื่อแบบเก่าและแบบใหม่
    const goalsDone =
      (typeof d.goalsCleared === 'number') ? d.goalsCleared :
      (typeof d.goals === 'number')        ? d.goals :
      (d.goalCleared ? 1 : 0);

    const goalsTotal =
      (typeof d.goalsTotal === 'number')   ? d.goalsTotal :
      (typeof d.goalsTarget === 'number')  ? d.goalsTarget :
      (goalsDone || 1);

    const minisDone =
      (typeof d.miniCleared === 'number')  ? d.miniCleared :
      (typeof d.quests === 'number')       ? d.quests :
      (d.miniCleared ? 1 : 0);

    const minisTotal =
      (typeof d.miniTotal === 'number')    ? d.miniTotal :
      (typeof d.questsTotal === 'number')  ? d.questsTotal :
      (minisDone || 1);

    const summary = {
      mode: modeLabel,
      grade,
      totalScore: d.score || 0,
      bestCombo: d.comboMax || 0,
      miss: d.misses || 0,
      goalsCleared: goalsDone,
      goalsTarget: goalsTotal,
      minisCleared: minisDone,
      minisTarget: minisTotal
    };

    showResultModal(summary);
  });

  // =====================================================
  //  2) เผื่อกรณี safe.js ยิง event 'hydration:finish' ด้วย
  //    (บางเวอร์ชันของคุณอาจใช้ event นี้)
  // =====================================================
  ROOT.addEventListener('hydration:finish', (ev) => {
    const s = ev.detail || {};
    if (!s) return;

    const summary = {
      mode: s.mode || 'Hydration Quest VR',
      grade: s.grade || calcGrade(s.totalScore || s.score || 0, s.miss || s.misses || 0),
      totalScore: s.totalScore || s.score || 0,
      bestCombo: s.bestCombo || s.comboMax || 0,
      miss: s.miss || s.misses || 0,
      goalsCleared: s.goalsCleared || s.goals || 0,
      goalsTarget: s.goalsTotal || s.goalsTarget ||
        (s.goalsCleared || s.goals || 1),
      minisCleared: s.minisCleared || s.quests || 0,
      minisTarget: s.minisTotal || s.questsTotal ||
        (s.minisCleared || s.quests || 1)
    };

    showResultModal(summary);
  });

})();
