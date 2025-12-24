// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM)
// FIX-ALL: quest/update + fever compatibility + rank + end summary
// ✅ Safe if elements missing
// ✅ Prevent double-binding
// ✅ Coach mood image names fixed: coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // Prevent double init
  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  // ---------- helpers ----------
  const $ = (sel) => { try { return doc.querySelector(sel); } catch { return null; } };
  const setText = (el, v) => { if (!el) return; try { el.textContent = String(v ?? ''); } catch {} };
  const clamp = (v, a, b) => { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); };

  // ---------- elements (optional) ----------
  const elScore    = $('#hud-score');
  const elCombo    = $('#hud-combo');
  const elMiss     = $('#hud-miss');
  const elShield   = $('#hud-shield');
  const elTime     = $('#hud-time');

  const elGoalLbl  = $('#hud-goal');
  const elGoalProg = $('#hud-goal-prog');
  const elMiniLbl  = $('#hud-mini');
  const elMiniProg = $('#hud-mini-prog');
  const elGroup    = $('#hud-group');

  const elCoachTxt = $('#hud-coach');
  const elCoachImg = $('#hud-coach-img');

  const elRank     = $('#hud-rank');

  // End overlay (optional)
  const elEndOverlay = $('#endOverlay');
  const elEndGrade   = $('#endGrade');
  const elEndScore   = $('#endScore');
  const elEndComboMax= $('#endComboMax');
  const elEndMiss    = $('#endMiss');
  const elEndGoals   = $('#endGoals');
  const elEndMinis   = $('#endMinis');

  // ---------- coach mood images ----------
  const COACH_IMG = {
    fever: './img/coach-fever.png',
    happy: './img/coach-happy.png',
    neutral: './img/coach-neutral.png',
    sad: './img/coach-sad.png'
  };

  let lastCoachMood = 'neutral';
  function setCoachMood(mood) {
    const m = String(mood || '').toLowerCase();
    const pick =
      (m.includes('fever') || m.includes('fire') || m.includes('hot')) ? 'fever' :
      (m.includes('happy') || m.includes('win') || m.includes('good') || m.includes('success')) ? 'happy' :
      (m.includes('sad') || m.includes('miss') || m.includes('bad') || m.includes('fail')) ? 'sad' :
      'neutral';

    if (pick === lastCoachMood) return;
    lastCoachMood = pick;
    if (!elCoachImg) return;
    try { elCoachImg.src = COACH_IMG[pick] || COACH_IMG.neutral; } catch {}
  }

  // ---------- score/hud state ----------
  let sScore = 0, sCombo = 0, sMiss = 0, sShield = 0, sFever = 0;
  let qGoal = null, qMini = null, qGroupLabel = '';
  let qQuestOk = true;

  function renderScore() {
    setText(elScore, sScore | 0);
    setText(elCombo, sCombo | 0);
    setText(elMiss,  sMiss  | 0);
    setText(elShield, sShield | 0);
  }

  function fmtProg(prog, target) {
    const p = (prog == null) ? 0 : (Number(prog) || 0);
    const t = (target == null) ? 0 : (Number(target) || 0);
    return `${Math.max(0, p|0)}/${Math.max(0, t|0)}`;
  }

  function renderQuest() {
    if (!qQuestOk) {
      setText(elGoalLbl,  '⚠️ QUEST ไม่พร้อม');
      setText(elGoalProg, '—');
      setText(elMiniLbl,  'เช็คไฟล์ groups-quests.js');
      setText(elMiniProg, '—');
      setText(elGroup,    '—');
      return;
    }

    if (qGoal) {
      setText(elGoalLbl,  qGoal.label || '—');
      setText(elGoalProg, fmtProg(qGoal.prog, qGoal.target));
    } else {
      setText(elGoalLbl,  '✅ Goal ครบแล้ว');
      setText(elGoalProg, '✓');
    }

    if (qMini) {
      // support rush-window: show tLeft if present
      const hasTL = (qMini.tLeft != null && qMini.windowSec != null);
      setText(elMiniLbl, qMini.label || '—');
      if (hasTL) {
        setText(elMiniProg, `${fmtProg(qMini.prog, qMini.target)}  ⏱ ${Math.max(0, qMini.tLeft|0)}s`);
      } else {
        setText(elMiniProg, fmtProg(qMini.prog, qMini.target));
      }
    } else {
      setText(elMiniLbl,  '✨ Mini ครบแล้ว');
      setText(elMiniProg, '✓');
    }

    setText(elGroup, qGroupLabel || '—');
  }

  function renderRankLine(detail) {
    if (!elRank) return;
    const g = String((detail && detail.grade) || '').toUpperCase().trim() || 'C';
    const sps = (detail && detail.scorePerSec != null) ? Number(detail.scorePerSec) : null;
    const acc = (detail && detail.accuracy != null) ? Number(detail.accuracy) : null;
    const qp  = (detail && detail.questsPct != null) ? Number(detail.questsPct) : null;

    // compact line
    const parts = [`Grade: ${g}`];
    if (sps != null && Number.isFinite(sps)) parts.push(`SPS ${sps.toFixed(2)}`);
    if (acc != null && Number.isFinite(acc)) parts.push(`ACC ${acc|0}%`);
    if (qp  != null && Number.isFinite(qp))  parts.push(`Q ${qp|0}%`);

    setText(elRank, parts.join(' · '));
  }

  // ---------- events ----------
  root.addEventListener('hha:score', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    if (d.score != null)  sScore = d.score|0;
    if (d.combo != null)  sCombo = d.combo|0;
    if (d.misses != null) sMiss  = d.misses|0;
    if (d.shield != null) sShield = Number(d.shield)||0;
    if (d.fever != null)  sFever = Number(d.fever)||0;
    renderScore();
  });

  root.addEventListener('hha:time', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    if (d.left != null) setText(elTime, Math.max(0, d.left|0));
  });

  // Quest update from engines (GoodJunk/Groups/Hydration/Plate)
  root.addEventListener('quest:update', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    qQuestOk = (d.questOk !== false);

    qGoal = d.goal || null;
    qMini = d.mini || null;

    // group label
    qGroupLabel = String(d.groupLabel || '');
    renderQuest();
  });

  // Coach messages
  root.addEventListener('hha:coach', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    const text = (d.text != null) ? String(d.text) : '';
    if (text) setText(elCoachTxt, text);

    // mood: explicit or infer from message
    if (d.mood) {
      setCoachMood(d.mood);
    } else if (text) {
      const t = text.toLowerCase();
      if (t.includes('fever') || t.includes('🔥')) setCoachMood('fever');
      else if (t.includes('ผ่าน') || t.includes('เยี่ยม') || t.includes('สำเร็จ') || t.includes('🎉') || t.includes('⭐')) setCoachMood('happy');
      else if (t.includes('miss') || t.includes('โดน') || t.includes('พลาด') || t.includes('😵') || t.includes('⚠️')) setCoachMood('sad');
      else setCoachMood('neutral');
    }
  });

  // Fever compat channel (some UIs want this)
  root.addEventListener('hha:fever', (ev) => {
    // We don't draw fever bar here (ui-fever.js does)
    // but we can switch coach mood if fever turns on
    const d = ev && ev.detail ? ev.detail : {};
    if (d.on === true) setCoachMood('fever');
  });

  // Rank
  root.addEventListener('hha:rank', (ev) => {
    renderRankLine(ev && ev.detail ? ev.detail : {});
  });

  // Panic/Rush/Wave are visualized in html badges (glue script), but keep compatibility if needed
  root.addEventListener('hha:panic', () => {});
  root.addEventListener('hha:rush',  () => {});
  root.addEventListener('groups:danger', () => {});

  // End summary
  root.addEventListener('hha:end', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    const grade = String(d.grade || 'C').toUpperCase();

    // if end overlay exists
    if (elEndOverlay) {
      try { elEndOverlay.classList.add('show'); } catch {}
    }

    if (elEndGrade) {
      setText(elEndGrade, grade);
      try {
        elEndGrade.className = 'kpi grade ' + grade.toLowerCase();
      } catch {}
    }
    setText(elEndScore, d.scoreFinal ?? 0);
    setText(elEndComboMax, d.comboMax ?? 0);
    setText(elEndMiss, d.misses ?? 0);

    if (elEndGoals) {
      setText(elEndGoals, `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`);
    }
    if (elEndMinis) {
      setText(elEndMinis, `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`);
    }

    // Coach final mood
    if (grade === 'SSS' || grade === 'SS' || grade === 'S') setCoachMood('happy');
    else if ((d.misses|0) >= 8) setCoachMood('sad');
    else setCoachMood('neutral');
  });

  // ---------- initial paint ----------
  renderScore();
  renderQuest();
  renderRankLine({ grade: 'C' });

})(window);