// === /herohealth/plate/plate-hud.js ===
// HHA Plate HUD Binder — SAFE
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const $ = (id) => doc.getElementById(id);

  const el = {
    uiScore: $('uiScore'),
    uiCombo: $('uiCombo'),
    uiComboMax: $('uiComboMax'),
    uiMiss: $('uiMiss'),
    uiTime: $('uiTime'),
    uiPlateHave: $('uiPlateHave'),
    uiGrade: $('uiGrade'),
    uiAcc: $('uiAcc'),

    uiG1: $('uiG1'), uiG2: $('uiG2'), uiG3: $('uiG3'), uiG4: $('uiG4'), uiG5: $('uiG5'),

    uiFeverFill: $('uiFeverFill'),
    uiShield: $('uiShield'),
    uiShieldN: $('uiShieldN'),

    coachMsg: $('coachMsg'),
    coachImg: $('coachImg'),

    uiGoalTitle: $('uiGoalTitle'),
    uiGoalCount: $('uiGoalCount'),
    uiGoalFill: $('uiGoalFill'),

    uiMiniTitle: $('uiMiniTitle'),
    uiMiniCount: $('uiMiniCount'),
    uiMiniTime: $('uiMiniTime'),
    uiMiniFill: $('uiMiniFill'),
    uiHint: $('uiHint'),

    startOverlay: $('startOverlay'),
    btnStart: $('btnStart'),

    hudPaused: $('hudPaused'),
    btnPause: $('btnPause'),
    btnRestart: $('btnRestart'),
    btnEnterVR: $('btnEnterVR'),
    btnBackHub: $('btnBackHub'),
    btnPlayAgain: $('btnPlayAgain'),

    resultBackdrop: $('resultBackdrop'),
    rMode: $('rMode'),
    rGrade: $('rGrade'),
    rScore: $('rScore'),
    rMaxCombo: $('rMaxCombo'),
    rMiss: $('rMiss'),
    rPerfect: $('rPerfect'),
    rGoals: $('rGoals'),
    rMinis: $('rMinis'),
    rG1: $('rG1'), rG2: $('rG2'), rG3: $('rG3'), rG4: $('rG4'), rG5: $('rG5'),
    rGTotal: $('rGTotal'),
  };

  function setText(node, v){
    if (!node) return;
    node.textContent = (v === undefined || v === null) ? '' : String(v);
  }
  function setFill(node, pct){
    if (!node) return;
    const p = Math.max(0, Math.min(100, Number(pct)||0));
    node.style.width = p + '%';
  }

  // Score/timer updates
  doc.addEventListener('hha:score', (ev) => {
    const d = (ev && ev.detail) || {};
    setText(el.uiScore, d.score ?? 0);
    setText(el.uiCombo, d.combo ?? 0);
    setText(el.uiComboMax, d.comboMax ?? 0);
    setText(el.uiMiss, d.misses ?? 0);

    setText(el.uiPlateHave, d.plateHave ?? 0);

    setText(el.uiGrade, d.grade ?? 'C');
    setText(el.uiAcc, (d.accuracyGoodPct ?? 0) + '%');

    setText(el.uiG1, d.g1 ?? 0);
    setText(el.uiG2, d.g2 ?? 0);
    setText(el.uiG3, d.g3 ?? 0);
    setText(el.uiG4, d.g4 ?? 0);
    setText(el.uiG5, d.g5 ?? 0);
  });

  doc.addEventListener('hha:time', (ev) => {
    const d = (ev && ev.detail) || {};
    setText(el.uiTime, d.timeLeftSec ?? d.timeSec ?? 0);
  });

  doc.addEventListener('hha:fever', (ev) => {
    const d = (ev && ev.detail) || {};
    setFill(el.uiFeverFill, d.feverPct ?? 0);
    if (el.uiShieldN) setText(el.uiShieldN, d.shield ?? 0);
    if (el.uiShield) {
      el.uiShield.style.opacity = (d.shield && d.shield>0) ? '1' : '0.45';
      el.uiShield.style.transform = (d.shield && d.shield>0) ? 'scale(1.02)' : 'scale(1)';
    }
  });

  // Quest update (goal + mini)
  doc.addEventListener('quest:update', (ev) => {
    const d = (ev && ev.detail) || {};
    if (d.goal){
      setText(el.uiGoalTitle, d.goal.title ?? '—');
      setText(el.uiGoalCount, `${d.goal.cur ?? 0}/${d.goal.target ?? 0}`);
      setFill(el.uiGoalFill, d.goal.pct ?? 0);
    }
    if (d.mini){
      setText(el.uiMiniTitle, d.mini.title ?? '—');
      setText(el.uiMiniCount, `${d.mini.cur ?? 0}/${d.mini.target ?? 0}`);
      setText(el.uiMiniTime, (d.mini.timeLeftSec ?? '--'));
      setFill(el.uiMiniFill, d.mini.pct ?? 0);
      if (el.uiHint && d.mini.hint !== undefined) setText(el.uiHint, d.mini.hint);
    }
  });

  // Coach
  doc.addEventListener('hha:coach', (ev) => {
    const d = (ev && ev.detail) || {};
    if (el.coachMsg && d.msg) setText(el.coachMsg, d.msg);
    if (el.coachImg && d.mood){
      // mood: neutral/happy/sad/fever
      const map = {
        neutral: '../img/coach-neutral.png',
        happy:   '../img/coach-happy.png',
        sad:     '../img/coach-sad.png',
        fever:   '../img/coach-fever.png',
      };
      // NOTE: plate-vr.html(root) uses ./img/.., plate/plate-vr.html uses ../img/..
      // We'll patch dynamically later in plate.safe.js; here just swap if relative works.
      el.coachImg.src = map[d.mood] || el.coachImg.src;
    }
  });

  // Pause overlay toggle (plate.safe.js will dispatch hha:pause too if needed)
  doc.addEventListener('hha:pause', (ev) => {
    const d = (ev && ev.detail) || {};
    if (!el.hudPaused) return;
    el.hudPaused.style.display = d.paused ? 'flex' : 'none';
  });

  // End summary
  doc.addEventListener('hha:end', (ev) => {
    const d = (ev && ev.detail) || {};
    if (el.resultBackdrop) el.resultBackdrop.style.display = 'flex';

    setText(el.rMode, d.runMode ?? 'play');
    setText(el.rGrade, d.grade ?? 'C');
    setText(el.rScore, d.score ?? 0);
    setText(el.rMaxCombo, d.comboMax ?? 0);
    setText(el.rMiss, d.misses ?? 0);
    setText(el.rPerfect, d.fastHit ?? 0);

    setText(el.rGoals, `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`);
    setText(el.rMinis, `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`);

    setText(el.rG1, d.g1 ?? 0);
    setText(el.rG2, d.g2 ?? 0);
    setText(el.rG3, d.g3 ?? 0);
    setText(el.rG4, d.g4 ?? 0);
    setText(el.rG5, d.g5 ?? 0);
    setText(el.rGTotal, d.gTotal ?? 0);
  });

})(window);