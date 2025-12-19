// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) for GoodJunk
// PATCH(A): ยิง event quest:update แบบ “มาตรฐาน HUD” + quest:cleared
// - ทุกครั้งที่ progress เปลี่ยน จะ dispatch quest:update
// - เมื่อ goal/min i ผ่าน จะ dispatch quest:cleared (ให้ HUD/FX ใช้ร่วมกัน)
// - payload:
//   quest:update.detail = {
//     goal:{title,cur,max,pct,state},
//     mini:{title,cur,max,pct,timeLeft,timeTotal,state},
//     meta:{goalIndex,miniCount,diff}
//   }

'use strict';

function clamp01(x) {
  x = Number(x);
  if (!isFinite(x)) x = 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function dispatch(name, detail) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function safeText(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  const s = String(v);
  return s.trim() ? s : fallback;
}

function ensureArr(a) { return Array.isArray(a) ? a : []; }

function pickOne(arr, fallback = null) {
  arr = ensureArr(arr);
  if (!arr.length) return fallback;
  return arr[(Math.random() * arr.length) | 0];
}

// mini factory: normalize to shape
function normMini(def) {
  const d = def || {};
  return {
    id: safeText(d.id, ''),
    title: safeText(d.title, 'Mini Quest'),
    kind: safeText(d.kind, 'count'), // 'count' | 'time'
    target: Number(d.target ?? d.max ?? 1),
    // time-based:
    timeTotalMs: Number(d.timeTotalMs ?? d.timeMs ?? 0),
    // optional predicate hooks:
    onStart: typeof d.onStart === 'function' ? d.onStart : null,
    onEvent: typeof d.onEvent === 'function' ? d.onEvent : null,
    // optional: compute pct from ctx
    pct: typeof d.pct === 'function' ? d.pct : null
  };
}

// goal factory: normalize to shape
function normGoal(def) {
  const d = def || {};
  return {
    id: safeText(d.id, ''),
    title: safeText(d.title, 'Goal'),
    target: Number(d.target ?? d.max ?? 1),
    // optional predicate hooks:
    onStart: typeof d.onStart === 'function' ? d.onStart : null,
    onEvent: typeof d.onEvent === 'function' ? d.onEvent : null,
    pct: typeof d.pct === 'function' ? d.pct : null
  };
}

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = ensureArr(opts.goalDefs).map(normGoal);
  const miniDefs = ensureArr(opts.miniDefs).map(normMini);

  const maxGoals = Math.max(1, Number(opts.maxGoals || 2));
  const maxMini = Math.max(1, Number(opts.maxMini || 999));

  // external ctx adapter: user will call director.onEvent('goodHit', ctx) etc.
  // We keep state simple and generic.

  const st = {
    goalsAll: goalDefs.slice(0),
    minisAll: miniDefs.slice(0),

    goalIndex: 0,
    miniCount: 0,

    activeGoal: null,
    activeMini: null,

    goalCur: 0,
    miniCur: 0,

    miniStartMs: 0,  // for time mini
    started: false,

    lastEmitKey: '',
    goalsCleared: 0,
    minisCleared: 0
  };

  function chooseGoal(i) {
    if (!st.goalsAll.length) return null;
    return st.goalsAll[Math.min(i, st.goalsAll.length - 1)];
  }

  function chooseMiniNext() {
    if (!st.minisAll.length) return null;
    return pickOne(st.minisAll, null);
  }

  function resetMini(def) {
    st.activeMini = def ? normMini(def) : null;
    st.miniCur = 0;
    st.miniStartMs = nowMs();
    if (st.activeMini && st.activeMini.onStart) {
      try { st.activeMini.onStart(); } catch (_) {}
    }
  }

  function resetGoal(def) {
    st.activeGoal = def ? normGoal(def) : null;
    st.goalCur = 0;
    if (st.activeGoal && st.activeGoal.onStart) {
      try { st.activeGoal.onStart(); } catch (_) {}
    }
  }

  function getMiniTimeLeftMs() {
    if (!st.activeMini) return null;
    if (st.activeMini.kind !== 'time') return null;
    const total = Math.max(0, Number(st.activeMini.timeTotalMs || 0));
    if (!total) return null;
    const elapsed = nowMs() - st.miniStartMs;
    return Math.max(0, total - elapsed);
  }

  function miniPctFromState(ctx) {
    if (!st.activeMini) return 0;
    const m = st.activeMini;

    if (typeof m.pct === 'function') {
      try {
        const v = m.pct(ctx || {});
        return clamp01(v);
      } catch (_) {}
    }

    if (m.kind === 'time') {
      const total = Math.max(1, Number(m.timeTotalMs || 1));
      const left = getMiniTimeLeftMs();
      if (left === null) return 0;
      // time quest usually progresses by accomplishing count, not by time.
      // But HUD needs pct: use count/target if target exists, else time-based countdown visual.
      if (m.target > 0) return clamp01(st.miniCur / m.target);
      return clamp01(1 - (left / total));
    }

    const target = Math.max(1, Number(m.target || 1));
    return clamp01(st.miniCur / target);
  }

  function goalPctFromState(ctx) {
    if (!st.activeGoal) return 0;
    const g = st.activeGoal;

    if (typeof g.pct === 'function') {
      try {
        const v = g.pct(ctx || {});
        return clamp01(v);
      } catch (_) {}
    }

    const target = Math.max(1, Number(g.target || 1));
    return clamp01(st.goalCur / target);
  }

  function buildPayload(ctx) {
    const g = st.activeGoal;
    const m = st.activeMini;

    const goalMax = g ? Math.max(0, Number(g.target || 0)) : 0;
    const miniMax = m ? Math.max(0, Number(m.target || 0)) : 0;

    const goalPct = goalPctFromState(ctx);
    const miniPct = miniPctFromState(ctx);

    const miniLeft = getMiniTimeLeftMs();
    const miniTotal = m && m.kind === 'time' ? Math.max(0, Number(m.timeTotalMs || 0)) : null;

    return {
      goal: g ? {
        title: g.title,
        cur: Math.max(0, st.goalCur),
        max: Math.max(0, goalMax),
        pct: goalPct,
        state: (st.goalsCleared >= st.goalIndex && goalPct >= 1) ? 'cleared' : 'active'
      } : null,
      mini: m ? {
        title: m.title,
        cur: Math.max(0, st.miniCur),
        max: Math.max(0, miniMax),
        pct: miniPct,
        timeLeft: (miniLeft !== null ? Math.max(0, miniLeft) : null),
        timeTotal: (miniTotal !== null ? miniTotal : null),
        state: (miniPct >= 1) ? 'cleared' : 'active'
      } : null,
      meta: {
        goalIndex: st.goalIndex,
        miniCount: st.miniCount,
        diff
      }
    };
  }

  function emitUpdate(ctx, force = false) {
    const p = buildPayload(ctx);
    const key = JSON.stringify([
      p.goal ? [p.goal.title, p.goal.cur, p.goal.max, Math.round((p.goal.pct || 0) * 1000), p.goal.state] : null,
      p.mini ? [p.mini.title, p.mini.cur, p.mini.max, Math.round((p.mini.pct || 0) * 1000), p.mini.state, p.mini.timeLeft ? Math.round(p.mini.timeLeft / 100) : null] : null,
      p.meta.goalIndex,
      p.meta.miniCount
    ]);

    if (!force && key === st.lastEmitKey) return;
    st.lastEmitKey = key;

    dispatch('quest:update', p);
  }

  function clearMini(ctx) {
    st.minisCleared += 1;
    dispatch('quest:cleared', {
      kind: 'mini',
      title: st.activeMini ? st.activeMini.title : '',
      miniCount: st.miniCount,
      minisCleared: st.minisCleared
    });
    // next mini
    st.miniCount += 1;
    if (st.miniCount >= maxMini) {
      // stop chaining; keep last cleared state
      resetMini(null);
    } else {
      resetMini(chooseMiniNext());
    }
    emitUpdate(ctx, true);
  }

  function clearGoal(ctx) {
    st.goalsCleared += 1;
    dispatch('quest:cleared', {
      kind: 'goal',
      title: st.activeGoal ? st.activeGoal.title : '',
      goalIndex: st.goalIndex,
      goalsCleared: st.goalsCleared
    });

    st.goalIndex += 1;
    if (st.goalIndex >= maxGoals) {
      // no more goals; keep null or last state
      resetGoal(null);
    } else {
      resetGoal(chooseGoal(st.goalIndex));
    }
    emitUpdate(ctx, true);
  }

  // public API
  const api = {
    start(ctx = {}) {
      if (st.started) return;
      st.started = true;

      // init first goal + mini
      resetGoal(chooseGoal(st.goalIndex));
      resetMini(chooseMiniNext());

      emitUpdate(ctx, true);
    },

    // Generic event hook from game:
    // type examples: 'goodHit', 'junkHit', 'perfectHit', 'goodExpired', 'shieldBlock', 'tick'
    onEvent(type, ctx = {}) {
      if (!st.started) api.start(ctx);

      const t = String(type || '').toLowerCase();

      // Allow defs to react first
      if (st.activeGoal && st.activeGoal.onEvent) {
        try { st.activeGoal.onEvent(t, ctx, st); } catch (_) {}
      }
      if (st.activeMini && st.activeMini.onEvent) {
        try { st.activeMini.onEvent(t, ctx, st); } catch (_) {}
      }

      // --- Default generic progress rules (safe fallback) ---
      // Goal progress: count "good hits" by default
      if (t === 'goodhit' || t === 'perfecthit') {
        if (st.activeGoal) st.goalCur += 1;
        if (st.activeMini && st.activeMini.kind === 'count') st.miniCur += 1;
      }

      // Example: a mini could be "avoid junk during X seconds"
      // -> should be handled by miniDefs.onEvent; we keep default minimal.

      // Time mini timeout check
      if (st.activeMini && st.activeMini.kind === 'time') {
        const left = getMiniTimeLeftMs();
        if (left !== null && left <= 0) {
          // time out => reset mini (fail) but keep chaining
          resetMini(chooseMiniNext());
          emitUpdate(ctx, true);
          return;
        }
      }

      // Check clear conditions
      // Goal
      if (st.activeGoal) {
        const goalTarget = Math.max(1, Number(st.activeGoal.target || 1));
        if (st.goalCur >= goalTarget) {
          clearGoal(ctx);
          // After goal clear, do not fall through
          return;
        }
      }
      // Mini
      if (st.activeMini) {
        const miniTarget = Math.max(1, Number(st.activeMini.target || 1));
        if (st.activeMini.kind !== 'time' && st.miniCur >= miniTarget) {
          clearMini(ctx);
          return;
        }
        // time mini can also have target count within time window
        if (st.activeMini.kind === 'time' && miniTarget > 0 && st.miniCur >= miniTarget) {
          clearMini(ctx);
          return;
        }
      }

      // Emit progress updates (throttle by key)
      emitUpdate(ctx, false);
    },

    // If engine has its own tick loop, call this each frame/interval to update timer display
    tick(ctx = {}) {
      if (!st.started) return;
      // emit timer changes more frequently, but still keyed with timeLeft bucketed
      emitUpdate(ctx, false);
    },

    // stats getters
    getState() {
      return {
        goalIndex: st.goalIndex,
        miniCount: st.miniCount,
        goalsCleared: st.goalsCleared,
        minisCleared: st.minisCleared,
        activeGoal: st.activeGoal,
        activeMini: st.activeMini,
        goalCur: st.goalCur,
        miniCur: st.miniCur
      };
    }
  };

  return api;
}
