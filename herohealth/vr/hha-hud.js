// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR)
// ✅ listens: hha:score, hha:time, hha:coach, quest:update, hha:quest, hha:end
// ✅ robust field mapping + late-bind cache window.__HHA_LAST_QUEST__
// ✅ safe if elements are missing
// ✅ binds to BOTH window + document (เผื่อเกม dispatch คนละที่)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  const $ = (id) => doc.getElementById(id);

  const els = {
    score: $('hhaScore'),
    combo: $('hhaCombo'),
    miss: $('hhaMiss'),
    time: $('hhaTime'),
    grade: $('hhaGrade'),

    coachImg: $('hhaCoachImg'),
    coachLine: $('hhaCoachLine'),
    coachSub: $('hhaCoachSub'),

    qMeta: $('hhaQuestMeta'),
    qGoalTitle: $('qGoalTitle'),
    qGoalCur: $('qGoalCur'),
    qGoalMax: $('qGoalMax'),
    qGoalFill: $('qGoalFill'),

    qMiniTitle: $('qMiniTitle'),
    qMiniCur: $('qMiniCur'),
    qMiniMax: $('qMiniMax'),
    qMiniFill: $('qMiniFill'),
    qMiniTLeft: $('qMiniTLeft'),

    endBox: $('hhaEnd'),
    endGrade: $('endGrade'),
    endScore: $('endScore'),
    endComboMax: $('endComboMax'),
    endMiss: $('endMiss'),
    endGoals: $('endGoals'),
    endGoalsTotal: $('endGoalsTotal'),
    endMinis: $('endMinis'),
    endMinisTotal: $('endMinisTotal'),
    endAcc: $('endAcc'),
  };

  function toNum(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  function toText(v, def = '—') {
    return (v === undefined || v === null || v === '') ? def : String(v);
  }
  function setText(el, v, def = '—') {
    if (!el) return;
    el.textContent = toText(v, def);
  }
  function setFill(el, cur, max) {
    if (!el) return;
    const c = Math.max(0, toNum(cur, 0));
    const m = Math.max(0, toNum(max, 0));
    const pct = (m > 0) ? Math.max(0, Math.min(100, (c / m) * 100)) : 0;
    el.style.width = `${pct.toFixed(1)}%`;
  }
  function prefix(label, s) {
    s = toText(s, '—');
    if (s === '—') return `${label}: —`;
    if (s.toLowerCase().startsWith(label.toLowerCase())) return s;
    if (s.startsWith(label + ':')) return s;
    return `${label}: ${s}`;
  }

  // bind helper (window + document)
  function bind(type, handler){
    root.addEventListener(type, handler, { passive:true });
    doc.addEventListener(type, handler, { passive:true });
  }

  // ---------------- score ----------------
  function onScore(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    setText(els.score, d.score ?? d.scoreFinal ?? 0, '0');
    setText(els.combo, d.combo ?? 0, '0');
    setText(els.miss, d.misses ?? d.miss ?? 0, '0');

    if (els.grade && (d.grade != null)) setText(els.grade, d.grade, '—');
  }

  // ---------------- time ----------------
  function onTime(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    let t = d.timeLeftSec;
    if (t == null) t = d.timeLeft;
    if (t == null) t = d.time;
    if (t == null) t = d.sec;

    if (t == null) return;
    t = Math.max(0, Math.round(toNum(t, 0)));
    setText(els.time, t, '0');
  }

  // ---------------- coach ----------------
  function onCoach(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (els.coachLine) setText(els.coachLine, d.line ?? d.text ?? '', '—');
    if (els.coachSub) setText(els.coachSub, d.sub ?? d.subtitle ?? '', '');

    if (els.coachImg && d.mood) {
      const m = String(d.mood).toLowerCase();
      const map = {
        happy: 'coach-happy.png',
        sad: 'coach-sad.png',
        fever: 'coach-fever.png',
        neutral: 'coach-neutral.png',
      };
      const fn = map[m];
      if (fn && !String(els.coachImg.src || '').includes(fn)) {
        const cur = els.coachImg.getAttribute('src') || '';
        const base = cur.includes('/img/') ? cur.split('/img/')[0] + '/img/' : './img/';
        els.coachImg.setAttribute('src', base + fn);
      }
    }
  }

  // ---------------- quest ----------------
  function normalizeQuestDetail(raw) {
    const d = raw || {};

    const goalTitle = d.goalTitle ?? d.goalText ?? d.goal ?? d.goal_name ?? d.goalName;
    const goalCur   = d.goalCur ?? d.goalCurrent ?? d.goalNow ?? d.gCur ?? d.gcur ?? 0;
    const goalMax   = d.goalMax ?? d.goalTarget ?? d.goalTotal ?? d.gMax ?? d.gmax ?? 0;

    const miniTitle = d.miniTitle ?? d.miniText ?? d.mini ?? d.mini_name ?? d.miniName;
    const miniCur   = d.miniCur ?? d.miniCurrent ?? d.miniNow ?? d.mCur ?? d.mcur ?? 0;
    const miniMax   = d.miniMax ?? d.miniTarget ?? d.miniTotal ?? d.mMax ?? d.mmax ?? 0;

    const miniTLeft = d.miniTLeft ?? d.tLeft ?? d.tleft ?? null;

    const goalsCleared = d.goalsCleared ?? d.goalCleared ?? 0;
    const goalsTotal   = d.goalsTotal ?? d.goalTotalAll ?? d.goalsAll ?? 0;
    const minisCleared = d.minisCleared ?? d.miniCleared ?? 0;
    const minisTotal   = d.minisTotal ?? d.miniTotalAll ?? d.minisAll ?? 0;

    const goalIndex = d.goalIndex ?? 0;
    const miniIndex = d.miniIndex ?? 0;

    return {
      goalTitle, goalCur, goalMax,
      miniTitle, miniCur, miniMax, miniTLeft,
      goalsCleared, goalsTotal, minisCleared, minisTotal,
      goalIndex, miniIndex,
    };
  }

  function paintQuest(detail) {
    const q = normalizeQuestDetail(detail);

    try { root.__HHA_LAST_QUEST__ = detail; } catch (_) {}

    if (els.qGoalTitle) setText(els.qGoalTitle, prefix('Goal', q.goalTitle), 'Goal: —');
    if (els.qGoalCur) setText(els.qGoalCur, toNum(q.goalCur, 0), '0');
    if (els.qGoalMax) setText(els.qGoalMax, toNum(q.goalMax, 0), '0');
    setFill(els.qGoalFill, q.goalCur, q.goalMax);

    if (els.qMiniTitle) setText(els.qMiniTitle, prefix('Mini', q.miniTitle), 'Mini: —');
    if (els.qMiniCur) setText(els.qMiniCur, toNum(q.miniCur, 0), '0');
    if (els.qMiniMax) setText(els.qMiniMax, toNum(q.miniMax, 0), '0');
    setFill(els.qMiniFill, q.miniCur, q.miniMax);

    if (els.qMiniTLeft) {
      if (q.miniTLeft == null) els.qMiniTLeft.textContent = '—';
      else els.qMiniTLeft.textContent = String(Math.max(0, toNum(q.miniTLeft, 0)));
    }

    if (els.qMeta) {
      const gT = Math.max(0, toNum(q.goalsTotal, 0));
      const mT = Math.max(0, toNum(q.minisTotal, 0));
      const gC = Math.max(0, toNum(q.goalsCleared, 0));
      const mC = Math.max(0, toNum(q.minisCleared, 0));

      let meta = '';
      if (gT > 0 || mT > 0) meta = `Goals ${gC}/${gT} • Minis ${mC}/${mT}`;
      else meta = `Goal#${toNum(q.goalIndex, 0)} • Mini#${toNum(q.miniIndex, 0)}`;
      els.qMeta.textContent = meta;
    }
  }

  function onQuest(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    paintQuest(d);
  }

  // ---------------- end ----------------
  function onEnd(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!els.endBox) return;

    setText(els.endGrade, d.grade ?? '—', '—');
    setText(els.endScore, d.scoreFinal ?? d.score ?? 0, '0');
    setText(els.endComboMax, d.comboMax ?? 0, '0');
    setText(els.endMiss, d.misses ?? 0, '0');

    setText(els.endGoals, d.goalsCleared ?? 0, '0');
    setText(els.endGoalsTotal, d.goalsTotal ?? 0, '0');
    setText(els.endMinis, d.miniCleared ?? d.minisCleared ?? 0, '0');
    setText(els.endMinisTotal, d.miniTotal ?? d.minisTotal ?? 0, '0');

    // ✅ prefer accuracyGoodPct
    setText(els.endAcc, d.accuracyGoodPct ?? d.accuracy ?? 0, '0');

    els.endBox.style.display = 'flex';
  }

  // bind
  bind('hha:score', onScore);
  bind('hha:time', onTime);
  bind('hha:coach', onCoach);

  // ✅ support both names
  bind('quest:update', onQuest);
  bind('hha:quest', onQuest);

  bind('hha:end', onEnd);

  // late-bind: if game already cached quest state
  try {
    if (root.__HHA_LAST_QUEST__) paintQuest(root.__HHA_LAST_QUEST__);
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);