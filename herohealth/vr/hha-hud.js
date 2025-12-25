// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM)
// FIX-ALL: quest/update + time compat + fever compat + rank + end summary
// ✅ Safe if elements missing
// ✅ Prevent double-binding
// ✅ Coach mood image names fixed: coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png
// ✅ Compat: quest:update supports {label/prog/target} + {title/cur/target/pct/done} + legacy flat fields
// ✅ Compat: hha:time supports {left} / {sec} / {timeLeft}
// ✅ Compat: hha:fever supports {on} + {fever,shield,stunActive}
// ✅ Compat: hha:end supports multiple keysets (GoodJunk emits {score,misses,comboMax,...})

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

  const toInt = (v, fb=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? (n|0) : (fb|0);
  };

  // pick first non-null/undefined
  const pick = (...xs) => {
    for (const x of xs) if (x !== undefined && x !== null) return x;
    return undefined;
  };

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
    const pickMood =
      (m.includes('fever') || m.includes('fire') || m.includes('hot')) ? 'fever' :
      (m.includes('happy') || m.includes('win') || m.includes('good') || m.includes('success')) ? 'happy' :
      (m.includes('sad') || m.includes('miss') || m.includes('bad') || m.includes('fail')) ? 'sad' :
      'neutral';

    if (pickMood === lastCoachMood) return;
    lastCoachMood = pickMood;
    if (!elCoachImg) return;
    try { elCoachImg.src = COACH_IMG[pickMood] || COACH_IMG.neutral; } catch {}
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

  function fmtProg(cur, target) {
    const c = toInt(cur, 0);
    const t = toInt(target, 0);
    return `${Math.max(0, c|0)}/${Math.max(0, t|0)}`;
  }

  // Normalize quest part to { label, prog, target, tLeft, windowSec, done, pct }
  function normQuestPart(part, fallbackTitle, fallbackCur, fallbackTarget) {
    if (!part) return null;

    const label = String(
      pick(part.label, part.title, part.name, fallbackTitle, '—')
    );

    // progress keys
    const prog = toInt(pick(
      part.prog, part.progress, part.cur, part.current, fallbackCur
    ), 0);

    const target = toInt(pick(
      part.target, part.tgt, part.goal, part.count, fallbackTarget
    ), 0);

    const pct = Number(pick(part.pct, part.percent, null));
    const done = !!pick(part.done, part.complete, part.completed, false);

    // rush-window keys (optional)
    const tLeft = pick(part.tLeft, part.timeLeft, null);
    const windowSec = pick(part.windowSec, part.window, null);

    return {
      label,
      prog,
      target,
      pct: Number.isFinite(pct) ? pct : null,
      done,
      tLeft: (tLeft == null ? null : toInt(tLeft, 0)),
      windowSec: (windowSec == null ? null : toInt(windowSec, 0))
    };
  }

  function renderQuest() {
    if (!qQuestOk) {
      setText(elGoalLbl,  '⚠️ QUEST ไม่พร้อม');
      setText(elGoalProg, '—');
      setText(elMiniLbl,  'ตรวจสอบไฟล์ quest ที่เกมใช้');
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

    const parts = [`Grade: ${g}`];
    if (sps != null && Number.isFinite(sps)) parts.push(`SPS ${sps.toFixed(2)}`);
    if (acc != null && Number.isFinite(acc)) parts.push(`ACC ${acc|0}%`);
    if (qp  != null && Number.isFinite(qp))  parts.push(`Q ${qp|0}%`);

    setText(elRank, parts.join(' · '));
  }

  // ---------- events ----------

  // score/hud
  root.addEventListener('hha:score', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};

    // score
    if (d.score != null)  sScore = toInt(d.score, sScore);

    // combo: accept multiple keys (some engines only send comboMax)
    const comboLike = pick(d.combo, d.comboNow, d.comboCur, d.comboCurrent, null);
    if (comboLike != null) sCombo = toInt(comboLike, sCombo);
    else if (d.comboMax != null && sCombo === 0) {
      // fallback: show comboMax if we never got current combo
      sCombo = toInt(d.comboMax, sCombo);
    }

    // miss
    if (d.misses != null) sMiss  = toInt(d.misses, sMiss);
    else if (d.miss != null) sMiss = toInt(d.miss, sMiss);

    // shield/fever sometimes come here (some engines do)
    if (d.shield != null) sShield = Number(d.shield)||0;
    if (d.fever != null)  sFever  = Number(d.fever)||0;

    renderScore();
  });

  // time compat: {left} (legacy) or {sec} (new) or {timeLeft}
  root.addEventListener('hha:time', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    const v = pick(d.left, d.sec, d.timeLeft, d.t, null);
    if (v != null) setText(elTime, Math.max(0, toInt(v, 0)));
  });

  // Quest update from engines (GoodJunk/Groups/Hydration/Plate)
  root.addEventListener('quest:update', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    qQuestOk = (d.questOk !== false);

    // Support multiple payload styles:
    // A) d.goal/d.mini objects:
    //    - {label, prog, target} (older)
    //    - {title, cur, target, pct, done} (new)
    // B) flat fields: goalTitle/goalCur/goalTarget, miniTitle/miniCur/miniTarget, miniTLeft/windowSec
    const gObj = d.goal || null;
    const mObj = d.mini || null;

    const gTitle = pick(d.goalTitle, d.goal_label, d.goalName, null);
    const gCur   = pick(d.goalCur, d.goalProg, d.goalProgress, null);
    const gTgt   = pick(d.goalTarget, d.goalTgt, null);

    const mTitle = pick(d.miniTitle, d.mini_label, d.miniName, null);
    const mCur   = pick(d.miniCur, d.miniProg, d.miniProgress, null);
    const mTgt   = pick(d.miniTarget, d.miniTgt, null);

    qGoal = gObj ? normQuestPart(gObj, gTitle, gCur, gTgt) : null;
    qMini = mObj ? normQuestPart(mObj, mTitle, mCur, mTgt) : null;

    // If engine sends flat only (no objects), build objects
    if (!qGoal && (gTitle != null || gCur != null || gTgt != null)) {
      qGoal = normQuestPart({ title: gTitle, cur: gCur, target: gTgt }, gTitle, gCur, gTgt);
    }
    if (!qMini && (mTitle != null || mCur != null || mTgt != null)) {
      const tLeft = pick(d.miniTLeft, d.miniTimeLeft, null);
      const win   = pick(d.miniWindowSec, d.miniWindow, null);
      qMini = normQuestPart({ title: mTitle, cur: mCur, target: mTgt, tLeft, windowSec: win }, mTitle, mCur, mTgt);
    }

    // group label
    qGroupLabel = String(pick(d.groupLabel, d.group, d.group_name, '') || '');

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

  // Fever compat channel
  root.addEventListener('hha:fever', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};

    // accept multiple formats
    const fever = pick(d.fever, d.value, d.level, null);
    if (fever != null) sFever = Number(fever) || 0;

    const shield = pick(d.shield, null);
    if (shield != null) sShield = Number(shield) || 0;

    renderScore();

    // mood if fever high or stun active
    const stun = !!pick(d.stunActive, d.stun, false);
    const on   = (pick(d.on, null) === true) || stun || (sFever >= 70);
    if (on) setCoachMood('fever');
  });

  // Rank
  root.addEventListener('hha:rank', (ev) => {
    renderRankLine(ev && ev.detail ? ev.detail : {});
  });

  // Panic/Rush/Wave compatibility (no-op)
  root.addEventListener('hha:panic', () => {});
  root.addEventListener('hha:rush',  () => {});
  root.addEventListener('groups:danger', () => {});

  // End summary (supports multiple keysets)
  root.addEventListener('hha:end', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};

    // Some engines send grade in end, some not
    const grade = String(pick(d.grade, d.rank, 'C') || 'C').toUpperCase();

    // if end overlay exists
    if (elEndOverlay) {
      try { elEndOverlay.classList.add('show'); } catch {}
    }

    if (elEndGrade) {
      setText(elEndGrade, grade);
      try { elEndGrade.className = 'kpi grade ' + grade.toLowerCase(); } catch {}
    }

    // score / comboMax / miss compat
    const scoreFinal = pick(d.scoreFinal, d.score, d.scoreEnd, 0);
    const comboMax   = pick(d.comboMax, d.combo_max, d.maxCombo, 0);
    const misses     = pick(d.misses, d.miss, d.missCount, 0);

    setText(elEndScore, scoreFinal ?? 0);
    setText(elEndComboMax, comboMax ?? 0);
    setText(elEndMiss, misses ?? 0);

    // quests counts (if provided)
    if (elEndGoals) {
      const gC = pick(d.goalsCleared, d.goalCleared, d.goalsDone, null);
      const gT = pick(d.goalsTotal, d.goalTotal, d.goalsAll, null);
      if (gC != null || gT != null) setText(elEndGoals, `${toInt(gC,0)}/${toInt(gT,0)}`);
      else setText(elEndGoals, '—');
    }
    if (elEndMinis) {
      const mC = pick(d.miniCleared, d.minisCleared, d.miniDone, null);
      const mT = pick(d.miniTotal, d.minisTotal, d.miniAll, null);
      if (mC != null || mT != null) setText(elEndMinis, `${toInt(mC,0)}/${toInt(mT,0)}`);
      else setText(elEndMinis, '—');
    }

    // Coach final mood
    if (grade === 'SSS' || grade === 'SS' || grade === 'S') setCoachMood('happy');
    else if (toInt(misses,0) >= 8) setCoachMood('sad');
    else setCoachMood('neutral');
  });

  // ---------- initial paint ----------
  renderScore();
  renderQuest();
  renderRankLine({ grade: 'C' });

})(window);
