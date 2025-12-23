// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) — FIX: supports targetByDiff/label
// Emits: quest:update (goal/mini/meta), quest:miniStart, quest:goalClear, quest:miniClear, quest:allGoalsClear

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

function pickTarget(def, diff){
  const d = String(diff||'normal').toLowerCase();

  // ✅ NEW: support targetByDiff {easy,normal,hard}
  const t1 = def && def.targetByDiff;
  if (t1 && (t1[d] != null || t1.normal != null)){
    return Number(t1[d] ?? t1.normal ?? 1) || 1;
  }

  // legacy: byDiff {easy,normal,hard}
  const t2 = def && def.byDiff;
  if (t2 && (t2[d] != null || t2.normal != null)){
    return Number(t2[d] ?? t2.normal ?? Object.values(t2)[0] ?? 1) || 1;
  }

  // legacy: value
  if (def && def.value != null) return Number(def.value) || 1;

  return 1;
}

function titleOf(def){
  return def?.title || def?.label || def?.id || 'Quest';
}

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];
  const maxGoals = Math.max(1, opts.maxGoals || Math.max(1, goalDefs.length || 1));
  const maxMini  = Math.max(1, opts.maxMini  || 999);

  const stateQ = {
    goalsAll: goalDefs.slice(0),
    minisAll: miniDefs.slice(0),
    goalIndex: 0,
    miniCount: 0,
    activeMini: null,
    activeGoal: null,
    started: false
  };

  function emitQuestUpdate(qState){
    const g = stateQ.activeGoal;
    const m = stateQ.activeMini;

    const goal = g ? {
      id: g.id,
      title: g.title,
      cur: g._cur|0,
      max: g._max|0,
      pct: (g._max>0) ? clamp(g._cur/g._max, 0, 1) : 0
    } : null;

    const mini = m ? {
      id: m.id,
      title: m.title,
      cur: m._cur|0,
      max: m._max|0,
      pct: (m._max>0) ? clamp(m._cur/m._max, 0, 1) : 0
    } : null;

    const meta = {
      goalsCleared: (stateQ.goalIndex|0),    // cleared so far
      goalIndex: (maxGoals|0),              // total goals (kept name for HUD compat)
      minisCleared: (qState?.minisCleared|0),
      miniCount: (stateQ.miniCount|0)       // started mini count
    };

    window.dispatchEvent(new CustomEvent('quest:update', { detail: { goal, mini, meta } }));
  }

  function startGoal(){
    const g = stateQ.goalsAll[stateQ.goalIndex] || null;
    if (!g){ stateQ.activeGoal = null; return; }

    stateQ.activeGoal = {
      ...g,
      id: g.id || ('goal_'+stateQ.goalIndex),
      title: titleOf(g),
      _cur: 0,
      _max: Math.max(1, pickTarget(g, diff))
    };
  }

  function startMini(qState){
    if (stateQ.miniCount >= maxMini) return;
    const len = Math.max(1, stateQ.minisAll.length);
    const idx = (stateQ.miniCount % len);
    const m = stateQ.minisAll[idx] || null;
    if (!m){ stateQ.activeMini = null; return; }

    stateQ.activeMini = {
      ...m,
      id: m.id || ('mini_'+stateQ.miniCount),
      title: titleOf(m),
      _cur: 0,
      _max: Math.max(1, pickTarget(m, diff))
    };

    stateQ.miniCount++;

    window.dispatchEvent(new CustomEvent('quest:miniStart', { detail: { id: stateQ.activeMini.id } }));
  }

  function evalDef(def, qState){
    // ✅ supports both styles:
    // - defs with eval(s) -> use it
    // - defs with type -> map from qState keys
    if (!def) return 0;

    if (typeof def.eval === 'function'){
      try{ return Number(def.eval(qState)) || 0; }catch(_){ return 0; }
    }

    const type = String(def.type||'').trim();
    if (!type) return 0;

    if (type === 'scoreAtLeast') return (qState.score|0);
    if (type === 'goodHitsAtLeast') return (qState.goodHits|0);
    if (type === 'streakGood') return (qState.streakGood|0);
    if (type === 'goldHitOnce') return (qState.goldHitsThisMini ? 1 : 0);
    if (type === 'blocksAtLeast') return (qState.blocks|0);

    return (qState[type]|0);
  }

  function passDef(def, v, t, qState){
    if (!def) return false;

    if (typeof def.pass === 'function'){
      try{ return !!def.pass(v, t, qState); }catch(_){ return false; }
    }

    return (Number(v)||0) >= (Number(t)||0);
  }

  function checkGoal(qState){
    const g = stateQ.activeGoal;
    if (!g) return false;

    g._cur = evalDef(g, qState) | 0;

    if (passDef(g, g._cur, g._max, qState)){
      window.dispatchEvent(new CustomEvent('quest:goalClear', {
        detail: { id:g.id, title:g.title, goalsCleared:(stateQ.goalIndex+1) }
      }));
      return true;
    }
    return false;
  }

  function checkMini(qState){
    const m = stateQ.activeMini;
    if (!m) return false;

    m._cur = evalDef(m, qState) | 0;

    if (passDef(m, m._cur, m._max, qState)){
      qState.minisCleared = (qState.minisCleared|0) + 1;
      window.dispatchEvent(new CustomEvent('quest:miniClear', {
        detail: { id:m.id, title:m.title, minisCleared:(qState.minisCleared|0) }
      }));
      return true;
    }
    return false;
  }

  function start(qState){
    if (stateQ.started) return;
    stateQ.started = true;

    qState.minisCleared = qState.minisCleared|0;

    stateQ.goalIndex = 0;
    stateQ.miniCount = 0;

    startGoal();
    startMini(qState);
    emitQuestUpdate(qState);
  }

  function tick(qState){
    if (!stateQ.started) return;

    // goal
    if (checkGoal(qState)){
      stateQ.goalIndex++;
      if (stateQ.goalIndex >= maxGoals || !stateQ.goalsAll[stateQ.goalIndex]){
        stateQ.activeGoal = null;
        window.dispatchEvent(new CustomEvent('quest:allGoalsClear', { detail:{} }));
      } else {
        startGoal();
      }
    }

    // mini
    if (checkMini(qState)){
      startMini(qState);
    }

    emitQuestUpdate(qState);
  }

  return { start, tick };
}