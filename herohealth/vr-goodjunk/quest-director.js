// === /herohealth/vr-goodjunk/quest-director.js ===
// GoodJunk Quest Director — PRODUCTION COMPAT (Dual-shape quest:update)
// Emits:
//  - quest:miniStart, quest:goalClear, quest:miniClear, quest:allGoalsClear
//  - quest:update  ✅ emits BOTH shapes (legacy flat + new nested)
// Works with UI/HUD that expects either shape.
// ✅ NEW: throttle quest:update via opts.emitMs (default 120ms) to save mobile performance
// ✅ PATCH C: goal/mini output includes target+max + done ; add getSummary() for grade/questsPct

'use strict';

const clamp01 = x => Math.max(0, Math.min(1, Number(x || 0)));
const nowMs = () => (performance && performance.now ? performance.now() : Date.now());

const emit = (n, d) => {
  try { window.dispatchEvent(new CustomEvent(n, { detail: d })); } catch (_) {}
};

function targetOf(def, diff) {
  const d = String(diff || 'normal').toLowerCase();
  const t1 = def && def.targetByDiff;
  if (t1 && (t1[d] != null || t1.normal != null)) return Number(t1[d] ?? t1.normal ?? 0) || 0;

  const t2 = def && def.byDiff;
  if (t2 && (t2[d] != null || t2.normal != null)) return Number(t2[d] ?? t2.normal ?? Object.values(t2)[0] ?? 0) || 0;

  if (def && def.value != null) return Number(def.value) || 0;
  return 0;
}

function normalizeDef(def) {
  if (!def) return null;

  if (typeof def.eval === 'function' && typeof def.pass === 'function') {
    return {
      id: def.id || def.key || def.label || def.title || '',
      label: def.label || def.title || def.id || 'Quest',
      eval: def.eval,
      pass: def.pass,
      targetByDiff: def.targetByDiff,
      byDiff: def.byDiff,
      value: def.value
    };
  }

  const type = String(def.type || '').trim();
  const label = def.label || def.title || def.id || 'Quest';
  const id = def.id || def.key || label;

  const evalFn = (s) => {
    if (!s) return 0;
    if (type === 'scoreAtLeast') return (s.score | 0);
    if (type === 'goodHitsAtLeast') return (s.goodHits | 0);
    if (type === 'streakGood') return (s.streakGood | 0);
    if (type === 'goldHitOnce') return (s.goldHitsThisMini ? 1 : 0);
    if (type === 'blocksAtLeast') return (s.blocks | 0);
    if (type) return (s[type] | 0);
    return 0;
  };

  const passFn = (v, t) => (Number(v) || 0) >= (Number(t) || 0);

  return { id, label, eval: evalFn, pass: passFn, targetByDiff: def.targetByDiff, byDiff: def.byDiff, value: def.value };
}

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();

  const goalsIn = (opts.goals || opts.goalDefs || []);
  const minisIn = (opts.minis || opts.miniDefs || []);

  const goals = (Array.isArray(goalsIn) ? goalsIn : []).map(normalizeDef).filter(Boolean);
  const minis = (Array.isArray(minisIn) ? minisIn : []).map(normalizeDef).filter(Boolean);

  const S = {
    goalIndex: 0,
    activeGoal: null,
    activeMini: null,
    minisCleared: 0,
    miniCount: 0
  };

  // ✅ Throttle
  const EMIT_MS = (opts.emitMs != null) ? Math.max(16, Number(opts.emitMs) || 120) : 120;
  let lastEmitAt = 0;

  function startGoal() {
    S.activeGoal = goals[S.goalIndex] || null;
  }

  function startMini() {
    if (!minis.length) { S.activeMini = null; return; }
    S.activeMini = minis[S.miniCount % minis.length] || null;
    S.miniCount++;
    emit('quest:miniStart', { id: S.activeMini?.id, title: S.activeMini?.label });
  }

  // ✅ PATCH: include target+max + done (consistent with engine/HUD)
  function computeGoalOut(s) {
    const g = S.activeGoal;
    if (!g) return null;
    const t = Math.max(1, targetOf(g, diff));
    const v = Number(g.eval(s)) || 0;
    const done = !!g.pass(v, t, s);
    return {
      title: g.label,
      cur: v,
      target: t,
      max: t,
      pct: clamp01(v / t),
      done
    };
  }

  function computeMiniOut(s) {
    const m = S.activeMini;
    if (!m) return null;
    const t = Math.max(1, targetOf(m, diff));
    const v = Number(m.eval(s)) || 0;
    const done = !!m.pass(v, t, s);
    return {
      title: m.label,
      cur: v,
      target: t,
      max: t,
      pct: clamp01(v / t),
      done
    };
  }

  function emitUpdate(s) {
    const goalOut = computeGoalOut(s);
    const miniOut = computeMiniOut(s);

    const meta = {
      goalsCleared: (S.goalIndex | 0),
      goalIndex: (goals.length | 0),
      minisCleared: (S.minisCleared | 0),
      miniCount: (S.miniCount | 0)
    };

    // ✅ New nested shape
    const nested = { goal: goalOut, mini: miniOut, meta, questOk: true };

    // ✅ Legacy flat shape
    const flat = {
      goalTitle: goalOut?.title || '',
      goalCur: (goalOut?.cur ?? 0) | 0,
      goalMax: (goalOut?.max ?? 1) | 0,
      goalTarget: (goalOut?.target ?? goalOut?.max ?? 1) | 0,
      goalPct: clamp01(goalOut?.pct ?? 0),

      miniTitle: miniOut?.title || '',
      miniCur: (miniOut?.cur ?? 0) | 0,
      miniMax: (miniOut?.max ?? 1) | 0,
      miniTarget: (miniOut?.target ?? miniOut?.max ?? 1) | 0,
      miniPct: clamp01(miniOut?.pct ?? 0),

      goalsCleared: meta.goalsCleared,
      goalsTotal: meta.goalIndex,
      minisCleared: meta.minisCleared,
      miniCount: meta.miniCount,

      questOk: true
    };

    emit('quest:update', Object.assign({}, flat, nested));
  }

  function tick(s) {
    if (!goals.length && !minis.length) {
      emit('quest:update', {
        goal: null,
        mini: null,
        meta: { goalsCleared: 0, goalIndex: 0, minisCleared: 0, miniCount: 0 },
        questOk: false
      });
      return;
    }

    if (S.activeGoal) {
      const t = Math.max(1, targetOf(S.activeGoal, diff));
      const v = Number(S.activeGoal.eval(s)) || 0;
      if (S.activeGoal.pass(v, t, s)) {
        emit('quest:goalClear', { title: S.activeGoal.label, id: S.activeGoal.id });
        S.goalIndex++;
        startGoal();
        if (!S.activeGoal) emit('quest:allGoalsClear', {});
      }
    }

    if (S.activeMini) {
      const t = Math.max(1, targetOf(S.activeMini, diff));
      const v = Number(S.activeMini.eval(s)) || 0;
      if (S.activeMini.pass(v, t, s)) {
        S.minisCleared++;
        emit('quest:miniClear', { title: S.activeMini.label, id: S.activeMini.id, minisCleared: S.minisCleared | 0 });
        startMini();
      }
    }

    // ✅ throttle quest:update (production-friendly)
    const tnow = nowMs();
    if ((tnow - lastEmitAt) >= EMIT_MS) {
      lastEmitAt = tnow;
      emitUpdate(s);
    }
  }

  function start(s) {
    S.goalIndex = 0;
    S.minisCleared = 0;
    S.miniCount = 0;
    startGoal();
    startMini();

    // ✅ start should always update immediately
    lastEmitAt = 0;
    emitUpdate(s);
  }

  function getActive() {
    const s = window.__GJ_QSTATE__ || {};
    const goalOut = computeGoalOut(s);
    const miniOut = computeMiniOut(s);
    return {
      goal: goalOut,
      mini: miniOut,
      meta: { goalsCleared: S.goalIndex | 0, goalIndex: goals.length | 0, minisCleared: S.minisCleared | 0, miniCount: S.miniCount | 0 }
    };
  }

  // ✅ PATCH: summary for grade/questsPct (cap minis to make % meaningful)
  function getSummary(){
    const goalsTotal = goals.length | 0;
    const goalsCleared = Math.min(S.goalIndex|0, goalsTotal);

    const MINI_CAP = 7; // ใช้ฐาน % mini (เช่น 7 mini แรก)
    const miniTotal = Math.max(1, MINI_CAP);
    const miniCleared = Math.min(S.minisCleared|0, MINI_CAP);

    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  return { start, tick, getActive, getSummary };
}