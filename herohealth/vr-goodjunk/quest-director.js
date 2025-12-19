// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) for GoodJunk
// PATCH(B): Play mode "สุ่มตามระดับ" (Goal 10 pick 2, Mini 15 pick 3)
//         + Research mode "Fix ตามระดับ" (ไม่สุ่ม)
//         + FIX: dispatch event บน window (HUD ฟังที่ window) เพื่อแก้ goal+mini ไม่แสดง
//
// Emits:
//  quest:update.detail = {
//    goal:{title,cur,max,pct,state},
//    mini:{title,cur,max,pct,timeLeft,timeTotal,state},
//    meta:{goalIndex,miniCount,diff,runMode,goalsPick,minisPick,goalsTotal,minisTotal}
//  }
//  quest:cleared.detail = { kind:'goal'|'mini', title, ...counts }

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

// ✅ FIX: HUD binder ส่วนใหญ่ฟัง window.addEventListener(...)
const BUS =
  (typeof window !== 'undefined' && window.dispatchEvent) ? window :
  (typeof document !== 'undefined' && document.dispatchEvent) ? document :
  null;

function dispatch(name, detail) {
  if (!BUS) return;
  BUS.dispatchEvent(new CustomEvent(name, { detail }));
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

function shuffleCopy(arr){
  const a = ensureArr(arr).slice();
  for (let i=a.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function pickN(arr, n){
  const a = shuffleCopy(arr);
  const k = Math.max(0, Math.min(Number(n)||0, a.length));
  return a.slice(0, k);
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

function pickDiffKey(diff){
  diff = String(diff || 'normal').toLowerCase();
  if (diff !== 'easy' && diff !== 'normal' && diff !== 'hard') return 'normal';
  return diff;
}

function asPoolByDiff(input, normalizer){
  // input can be:
  //  - { easy:[...], normal:[...], hard:[...] }
  //  - [... ] (fallback pool for all)
  const out = { easy:[], normal:[], hard:[] };
  if (Array.isArray(input)){
    const a = ensureArr(input).map(normalizer);
    out.easy = a.slice();
    out.normal = a.slice();
    out.hard = a.slice();
    return out;
  }
  const obj = input || {};
  out.easy   = ensureArr(obj.easy).map(normalizer);
  out.normal = ensureArr(obj.normal).map(normalizer);
  out.hard   = ensureArr(obj.hard).map(normalizer);
  // fallback: ถ้าขาดระดับไหน ให้ยืม normal
  if (!out.easy.length) out.easy = out.normal.slice();
  if (!out.hard.length) out.hard = out.normal.slice();
  return out;
}

function mapFixedIds(fixedByDiff){
  // fixedByDiff: { easy:{ goals:[id,id], minis:[id,id,id] }, ... }
  const obj = fixedByDiff || {};
  const mk = (x)=>({
    goals: ensureArr(x && x.goals).map(String),
    minis: ensureArr(x && x.minis).map(String)
  });
  return {
    easy: mk(obj.easy),
    normal: mk(obj.normal),
    hard: mk(obj.hard)
  };
}

function findById(pool, id){
  id = String(id || '');
  return ensureArr(pool).find(q => String(q.id) === id) || null;
}

export function makeQuestDirector(opts = {}) {
  const diffKey = pickDiffKey(opts.diff || 'normal');

  // runMode: 'play' | 'research' (default play)
  const runMode = (String(opts.runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';

  // ✅ สเปกที่ตกลงกัน
  const goalsPick = Math.max(1, Number(opts.goalsPick ?? 2));
  const minisPick = Math.max(1, Number(opts.minisPick ?? 3));

  // Pools by diff (recommended)
  const goalPoolsByDiff = asPoolByDiff(opts.goalPoolsByDiff ?? opts.goalDefs ?? [], normGoal);
  const miniPoolsByDiff = asPoolByDiff(opts.miniPoolsByDiff ?? opts.miniDefs ?? [], normMini);

  // Research fixed by diff (ids)
  const researchFixedByDiff = mapFixedIds(opts.researchFixedByDiff || opts.researchFixed || {});

  // Active pools chosen for this session
  const POOL_GOALS = goalPoolsByDiff[diffKey] || goalPoolsByDiff.normal;
  const POOL_MINIS = miniPoolsByDiff[diffKey] || miniPoolsByDiff.normal;

  // state
  const st = {
    started: false,

    diff: diffKey,
    runMode,

    // selected sets for this run (play=random pick; research=fixed)
    goalsSel: [],
    minisSel: [],

    goalIndex: 0,     // index in goalsSel
    miniIndex: 0,     // index in minisSel
    miniCount: 0,     // how many minis attempted so far (1-based display)

    activeGoal: null,
    activeMini: null,

    goalCur: 0,
    miniCur: 0,

    miniStartMs: 0,

    lastEmitKey: '',

    goalsCleared: 0,
    minisCleared: 0
  };

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

  function chooseMiniAt(i){
    if (!st.minisSel.length) return null;
    const idx = Math.min(Math.max(0, i|0), st.minisSel.length - 1);
    return st.minisSel[idx];
  }

  function chooseGoalAt(i){
    if (!st.goalsSel.length) return null;
    const idx = Math.min(Math.max(0, i|0), st.goalsSel.length - 1);
    return st.goalsSel[idx];
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
      try { return clamp01(m.pct(ctx || {})); } catch (_) {}
    }

    if (m.kind === 'time') {
      const total = Math.max(1, Number(m.timeTotalMs || 1));
      const left = getMiniTimeLeftMs();
      if (left === null) return 0;
      if (m.target > 0) return clamp01(st.miniCur / Math.max(1, m.target));
      return clamp01(1 - (left / total));
    }

    return clamp01(st.miniCur / Math.max(1, Number(m.target || 1)));
  }

  function goalPctFromState(ctx) {
    if (!st.activeGoal) return 0;
    const g = st.activeGoal;

    if (typeof g.pct === 'function') {
      try { return clamp01(g.pct(ctx || {})); } catch (_) {}
    }

    return clamp01(st.goalCur / Math.max(1, Number(g.target || 1)));
  }

  function buildPayload(ctx) {
    const g = st.activeGoal;
    const m = st.activeMini;

    const goalMax = g ? Math.max(0, Number(g.target || 0)) : 0;
    const miniMax = m ? Math.max(0, Number(m.target || 0)) : 0;

    const goalPct = goalPctFromState(ctx);
    const miniPct = miniPctFromState(ctx);

    const miniLeft = getMiniTimeLeftMs();
    const miniTotal = (m && m.kind === 'time') ? Math.max(0, Number(m.timeTotalMs || 0)) : null;

    return {
      goal: g ? {
        title: g.title,
        cur: Math.max(0, st.goalCur),
        max: Math.max(0, goalMax),
        pct: goalPct,
        state: (goalPct >= 1) ? 'cleared' : 'active'
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
        goalIndex: st.goalIndex,          // 0-based
        miniCount: st.miniCount,          // 1-based progress display style
        diff: st.diff,
        runMode: st.runMode,
        goalsPick,
        minisPick,
        goalsTotal: st.goalsSel.length,
        minisTotal: st.minisSel.length
      }
    };
  }

  function emitUpdate(ctx, force = false) {
    const p = buildPayload(ctx);
    const key = JSON.stringify([
      p.goal ? [p.goal.title, p.goal.cur, p.goal.max, Math.round((p.goal.pct || 0) * 1000), p.goal.state] : null,
      p.mini ? [p.mini.title, p.mini.cur, p.mini.max, Math.round((p.mini.pct || 0) * 1000), p.mini.state,
                (p.mini.timeLeft != null ? Math.round(p.mini.timeLeft / 100) : null)] : null,
      p.meta.goalIndex,
      p.meta.miniCount,
      p.meta.diff,
      p.meta.runMode
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
      miniIndex: st.miniIndex,
      miniCount: st.miniCount,
      minisCleared: st.minisCleared,
      minisTotal: st.minisSel.length,
      diff: st.diff,
      runMode: st.runMode
    });

    // next mini (ตามลิสต์ที่เลือกไว้แล้ว)
    st.miniIndex += 1;
    st.miniCount += 1;

    if (st.miniIndex >= st.minisSel.length) {
      resetMini(null);
    } else {
      resetMini(chooseMiniAt(st.miniIndex));
    }
    emitUpdate(ctx, true);
  }

  function clearGoal(ctx) {
    st.goalsCleared += 1;

    dispatch('quest:cleared', {
      kind: 'goal',
      title: st.activeGoal ? st.activeGoal.title : '',
      goalIndex: st.goalIndex,
      goalsCleared: st.goalsCleared,
      goalsTotal: st.goalsSel.length,
      diff: st.diff,
      runMode: st.runMode
    });

    st.goalIndex += 1;

    if (st.goalIndex >= st.goalsSel.length) {
      resetGoal(null);
    } else {
      resetGoal(chooseGoalAt(st.goalIndex));
    }
    emitUpdate(ctx, true);
  }

  // ✅ Build selected quests for this run (PLAY random by diff / RESEARCH fixed by diff)
  function buildSelectedSets(){
    // goalsSel
    if (st.runMode === 'research'){
      const fixed = researchFixedByDiff[st.diff] || researchFixedByDiff.normal || { goals:[], minis:[] };

      st.goalsSel = ensureArr(fixed.goals).map(id => findById(POOL_GOALS, id)).filter(Boolean);
      st.minisSel = ensureArr(fixed.minis).map(id => findById(POOL_MINIS, id)).filter(Boolean);

      // fallback ถ้า fixed ว่างจริง ๆ
      if (!st.goalsSel.length) st.goalsSel = pickN(POOL_GOALS, goalsPick);
      if (!st.minisSel.length) st.minisSel = pickN(POOL_MINIS, minisPick);

    } else {
      // ✅ play mode: “สุ่มตามระดับ” เท่านั้น
      st.goalsSel = pickN(POOL_GOALS, goalsPick);
      st.minisSel = pickN(POOL_MINIS, minisPick);
    }

    // reset indices
    st.goalIndex = 0;
    st.miniIndex = 0;
    st.miniCount = 1;

    st.goalsCleared = 0;
    st.minisCleared = 0;
  }

  // public API
  const api = {
    start(ctx = {}) {
      if (st.started) return;
      st.started = true;

      buildSelectedSets();

      resetGoal(chooseGoalAt(0));
      resetMini(chooseMiniAt(0));

      // ✅ ยิงครั้งแรกให้ HUD โชว์แน่นอน
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
      // Goal + Mini (count) progress: count "good hits" by default
      if (t === 'goodhit' || t === 'perfecthit') {
        if (st.activeGoal) st.goalCur += 1;
        if (st.activeMini && st.activeMini.kind === 'count') st.miniCur += 1;
      }

      // Time mini timeout check
      if (st.activeMini && st.activeMini.kind === 'time') {
        const left = getMiniTimeLeftMs();
        if (left !== null && left <= 0) {
          // time out => ถือว่า fail แล้วไป mini ถัดไป (ตามลิสต์) เพื่อคงจำนวน 3 mini ตามที่เลือก
          st.miniIndex += 1;
          st.miniCount += 1;
          if (st.miniIndex >= st.minisSel.length) resetMini(null);
          else resetMini(chooseMiniAt(st.miniIndex));
          emitUpdate(ctx, true);
          return;
        }
      }

      // Check clear conditions
      if (st.activeGoal) {
        const goalTarget = Math.max(1, Number(st.activeGoal.target || 1));
        if (st.goalCur >= goalTarget) {
          clearGoal(ctx);
          return;
        }
      }

      if (st.activeMini) {
        const miniTarget = Math.max(1, Number(st.activeMini.target || 1));
        if (st.activeMini.kind !== 'time' && st.miniCur >= miniTarget) {
          clearMini(ctx);
          return;
        }
        if (st.activeMini.kind === 'time' && miniTarget > 0 && st.miniCur >= miniTarget) {
          clearMini(ctx);
          return;
        }
      }

      emitUpdate(ctx, false);
    },

    // call periodically if you want timer refresh smoother
    tick(ctx = {}) {
      if (!st.started) return;
      emitUpdate(ctx, false);
    },

    // expose selected sets (useful for logger / HUD debug)
    getSelected() {
      return {
        diff: st.diff,
        runMode: st.runMode,
        goalsSel: st.goalsSel.slice(),
        minisSel: st.minisSel.slice()
      };
    },

    getState() {
      return {
        diff: st.diff,
        runMode: st.runMode,
        goalIndex: st.goalIndex,
        miniIndex: st.miniIndex,
        miniCount: st.miniCount,
        goalsCleared: st.goalsCleared,
        minisCleared: st.minisCleared,
        activeGoal: st.activeGoal,
        activeMini: st.activeMini,
        goalCur: st.goalCur,
        miniCur: st.miniCur,
        goalsTotal: st.goalsSel.length,
        minisTotal: st.minisSel.length
      };
    }
  };

  return api;
}
