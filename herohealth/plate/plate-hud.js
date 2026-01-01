// === /herohealth/plate/plate-hud.js ===
// HeroHealth Plate — HUD Binder (PRODUCTION)
// ✅ Listen: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Updates: top HUD, fever/shield, goal+mini bars, coach panel, result overlay
// ✅ Grade class support: SSS/SS/S/A/B/C (adds CSS classes to #uiGrade + #badgeGrade if exists)
// ✅ Safe: ignore if missing elements, prevent double-binding

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // prevent double-bind
  if (root.__HHA_PLATE_HUD_BOUND__) return;
  root.__HHA_PLATE_HUD_BOUND__ = true;

  const $ = (id) => DOC.getElementById(id);

  function clamp(v, a, b) {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  }

  function setText(id, v) {
    const el = $(id);
    if (el) el.textContent = String(v ?? '');
  }

  function setWidth(id, pct) {
    const el = $(id);
    if (!el) return;
    const p = clamp(pct, 0, 100);
    el.style.width = `${p}%`;
  }

  function fmtPct(x) {
    x = Number(x) || 0;
    return `${Math.round(x)}%`;
  }

  function isPlateEvent(detail) {
    // accept either detail.game === 'plate' or missing game (fallback)
    if (!detail || typeof detail !== 'object') return false;
    const g = String(detail.game || detail.gameMode || '').toLowerCase();
    return (!g || g === 'plate');
  }

  // ---------- Grade styling ----------
  const GRADE_CLASSES = ['g-SSS', 'g-SS', 'g-S', 'g-A', 'g-B', 'g-C'];

  function applyGrade(grade) {
    grade = String(grade || 'C').toUpperCase();
    const ui = $('uiGrade');
    if (ui) {
      ui.classList.remove(...GRADE_CLASSES);
      ui.classList.add(`g-${grade}`);
      ui.setAttribute('data-grade', grade);
      ui.textContent = grade;
    }
    // optional: if hub badge exists in this page (usually not)
    const bg = $('badgeGrade');
    if (bg) {
      bg.classList.remove(...GRADE_CLASSES);
      bg.classList.add(`g-${grade}`);
      bg.setAttribute('data-grade', grade);
      bg.textContent = `GRADE ${grade}`;
    }
  }

  // ---------- Quest UI ----------
  function updateGoalUI(goal) {
    if (!goal) {
      setText('uiGoalTitle', '—');
      setText('uiGoalCount', '0/0');
      setWidth('uiGoalFill', 0);
      return;
    }
    const cur = Number(goal.cur) || 0;
    const tar = Math.max(1, Number(goal.target) || 1);
    setText('uiGoalTitle', goal.title || '—');
    setText('uiGoalCount', `${cur}/${tar}`);
    setWidth('uiGoalFill', (cur / tar) * 100);
  }

  function updateMiniUI(mini, miniClearedHint) {
    if (!mini || !mini.title || mini.title === '—') {
      setText('uiMiniTitle', '—');
      if ($('uiMiniCount')) setText('uiMiniCount', (miniClearedHint != null) ? String(miniClearedHint) : '0/0');
      setText('uiMiniTime', '--');
      setWidth('uiMiniFill', 0);
      return;
    }

    setText('uiMiniTitle', mini.title || '—');

    // mini count: this page shows "miniCleared / something" in plate.safe.js
    // so we only set if passed in
    if (miniClearedHint != null && $('uiMiniCount')) {
      setText('uiMiniCount', String(miniClearedHint));
    }

    // timeLeft may be null
    if (mini.timeLeft == null) setText('uiMiniTime', '--');
    else setText('uiMiniTime', `${Math.ceil(Number(mini.timeLeft) || 0)}s`);

    // progress bar: if we know target + timeLeft
    const target = Math.max(1, Number(mini.target) || 1);
    const tl = (mini.timeLeft == null) ? null : Math.max(0, Number(mini.timeLeft) || 0);
    if (tl == null) setWidth('uiMiniFill', 0);
    else setWidth('uiMiniFill', ((target - tl) / target) * 100);

    // hint
    if ($('uiHint') && mini.hint) setText('uiHint', mini.hint);
  }

  // ---------- Coach UI ----------
  const DEFAULT_COACH_MAP = {
    happy: './img/coach-happy.png',
    neutral: './img/coach-neutral.png',
    sad: './img/coach-sad.png',
    fever: './img/coach-fever.png',
  };

  function updateCoach(msg, mood, imgOverride) {
    if ($('coachMsg') && msg != null) setText('coachMsg', msg);

    const img = $('coachImg');
    if (!img) return;

    // allow override from event
    if (imgOverride) {
      img.src = String(imgOverride);
      return;
    }

    const m = String(mood || 'neutral').toLowerCase();
    img.src = DEFAULT_COACH_MAP[m] || DEFAULT_COACH_MAP.neutral;
  }

  // ---------- Result overlay ----------
  function showResult(summary) {
    const wrap = $('resultBackdrop');
    if (!wrap) return;

    // let game code control display; but if not shown yet, show it
    if (wrap.style.display === 'none' || !wrap.style.display) {
      wrap.style.display = 'grid';
    }

    setText('rMode', summary.runMode || summary.run || 'play');
    setText('rGrade', summary.grade || 'C');
    setText('rScore', summary.scoreFinal ?? 0);
    setText('rMaxCombo', summary.comboMax ?? 0);
    setText('rMiss', summary.misses ?? 0);

    // fast hit stored as percent in plate.safe.js summary
    if (summary.fastHitRatePct != null) setText('rPerfect', `${Math.round(Number(summary.fastHitRatePct) || 0)}%`);
    else setText('rPerfect', '0%');

    setText('rGoals', `${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
    setText('rMinis', `${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}`);

    // plate counts
    const p = summary.plate || {};
    const c = Array.isArray(p.counts) ? p.counts : [0,0,0,0,0];
    setText('rG1', c[0] ?? 0);
    setText('rG2', c[1] ?? 0);
    setText('rG3', c[2] ?? 0);
    setText('rG4', c[3] ?? 0);
    setText('rG5', c[4] ?? 0);
    setText('rGTotal', p.total ?? (c.reduce((a,b)=>a+(Number(b)||0),0)));
  }

  // ---------- Main HUD update ----------
  function onScore(detail) {
    if (!isPlateEvent(detail)) return;

    // Top stats
    if (detail.score != null) setText('uiScore', detail.score);
    if (detail.combo != null) setText('uiCombo', detail.combo);
    if (detail.comboMax != null) setText('uiComboMax', detail.comboMax);
    if (detail.miss != null) setText('uiMiss', detail.miss);

    // plate
    if (detail.plateHave != null) setText('uiPlateHave', detail.plateHave);

    // groups counts
    if (Array.isArray(detail.gCount)) {
      setText('uiG1', detail.gCount[0] ?? 0);
      setText('uiG2', detail.gCount[1] ?? 0);
      setText('uiG3', detail.gCount[2] ?? 0);
      setText('uiG4', detail.gCount[3] ?? 0);
      setText('uiG5', detail.gCount[4] ?? 0);
    }

    // fever/shield
    if (detail.fever != null) setWidth('uiFeverFill', detail.fever);
    if (detail.shield != null) setText('uiShieldN', detail.shield);

    // accuracy/grade
    if (detail.accuracyGoodPct != null) setText('uiAcc', fmtPct(detail.accuracyGoodPct));
    if (detail.grade != null) applyGrade(detail.grade);

    // time
    if (detail.timeLeftSec != null) setText('uiTime', Math.ceil(Number(detail.timeLeftSec) || 0));
  }

  function onTime(detail) {
    if (!isPlateEvent(detail)) return;
    if (detail.timeLeftSec != null) setText('uiTime', Math.ceil(Number(detail.timeLeftSec) || 0));
  }

  function onQuest(detail) {
    if (!isPlateEvent(detail)) return;

    // goal
    updateGoalUI(detail.goal || null);

    // mini
    // plate.safe.js sets its own mini count string, but we support if provided
    // If engine sends { miniCleared, miniTotal }, you can pass it here later
    updateMiniUI(detail.mini || null, null);

    // hint support (optional)
    if (detail.hint && $('uiHint')) setText('uiHint', detail.hint);
  }

  function onCoach(detail) {
    if (!isPlateEvent(detail)) return;
    updateCoach(detail.msg, detail.mood, detail.img);
  }

  function onJudge(detail) {
    // Plate doesn't have dedicated judge label in HTML (it uses Particles layer / hitFx)
    // If later you add #uiJudge, we support it automatically.
    if (!isPlateEvent(detail)) return;
    if ($('uiJudge')) setText('uiJudge', detail.text || '');
  }

  function onEnd(detail) {
    if (!detail || typeof detail !== 'object') return;
    const summary = detail.summary || detail;
    const g = String(summary.game || summary.gameMode || detail.game || '').toLowerCase();
    if (g && g !== 'plate') return;

    // ensure grade applied
    if (summary.grade) applyGrade(summary.grade);

    // show result (safe)
    showResult(summary);
  }

  // ---------- Bind events ----------
  function bind() {
    root.addEventListener('hha:score', (e) => onScore(e.detail || {}), { passive: true });
    root.addEventListener('hha:time', (e) => onTime(e.detail || {}), { passive: true });
    root.addEventListener('quest:update', (e) => onQuest(e.detail || {}), { passive: true });
    root.addEventListener('hha:coach', (e) => onCoach(e.detail || {}), { passive: true });
    root.addEventListener('hha:judge', (e) => onJudge(e.detail || {}), { passive: true });
    root.addEventListener('hha:end', (e) => onEnd(e.detail || {}), { passive: true });

    // initial render defaults
    // (plate.safe.js also sets these, but this prevents blank on slow devices)
    if ($('uiAcc') && $('uiAcc').textContent.trim() === '') setText('uiAcc', '0%');
    if ($('uiGrade') && $('uiGrade').textContent.trim() === '') applyGrade('C');
  }

  // DOM already parsed? (script is defer, so usually yes)
  try { bind(); } catch (e) {}

})(typeof window !== 'undefined' ? window : globalThis);