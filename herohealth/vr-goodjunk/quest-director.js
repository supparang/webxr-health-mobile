// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) — H++ Pack

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

function pickByDiff(def, diff){
  const d = String(diff||'normal').toLowerCase();
  const map = def && def.byDiff ? def.byDiff : null;
  if (!map) return def?.value ?? 1;
  return map[d] ?? map.normal ?? Object.values(map)[0] ?? 1;
}

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];
  const maxGoals = Math.max(1, opts.maxGoals || 2);
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
      goalsCleared: stateQ.goalIndex|0,
      goalIndex: maxGoals|0,
      minisCleared: qState?.minisCleared|0,
      miniCount: stateQ.miniCount|0
    };

    window.dispatchEvent(new CustomEvent('quest:update', { detail: { goal, mini, meta } }));
  }

  function startGoal(){
    const g = stateQ.goalsAll[stateQ.goalIndex] || null;
    if (!g){ stateQ.activeGoal = null; return; }
    stateQ.activeGoal = { ...g, _cur:0, _max: Math.max(1, pickByDiff(g, diff)) };
  }

  function startMini(qState){
    if (stateQ.miniCount >= maxMini) return;
    const idx = (stateQ.miniCount % Math.max(1, stateQ.minisAll.length));
    const m = stateQ.minisAll[idx] || null;
    if (!m){ stateQ.activeMini = null; return; }

    stateQ.activeMini = { ...m, _cur:0, _max: Math.max(1, pickByDiff(m, diff)) };
    stateQ.miniCount++;

    // ให้เกม reset state บางอย่างได้เอง
    window.dispatchEvent(new CustomEvent('quest:miniStart', { detail: { id: stateQ.activeMini.id } }));
  }

  function checkGoal(qState){
    const g = stateQ.activeGoal;
    if (!g) return false;

    // เติม _cur ตามประเภท
    if (g.type === 'scoreAtLeast') g._cur = (qState.score|0);
    else if (g.type === 'goodHitsAtLeast') g._cur = (qState.goodHits|0);
    else g._cur = (qState[g.type]|0);

    if ((g._cur|0) >= (g._max|0)){
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

    // ✅ minis H++ types
    if (m.type === 'streakGood') m._cur = (qState.streakGood|0);
    else if (m.type === 'goldHitOnce') m._cur = (qState.goldHitsThisMini|0);
    else if (m.type === 'blocksAtLeast') m._cur = (qState.blocks|0);
    else if (m.type === 'hazardsSurviveStreak') m._cur = (qState.hazardsSurvivedStreak|0);
    else if (m.type === 'finalRageGoodHits') m._cur = (qState.rageGoodHits|0);
    else m._cur = (qState[m.type]|0);

    if ((m._cur|0) >= (m._max|0)){
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
    startGoal();
    startMini(qState);
    emitQuestUpdate(qState);
  }

  function tick(qState){
    if (!stateQ.started) return;

    // check goal
    if (checkGoal(qState)){
      stateQ.goalIndex++;
      if (stateQ.goalIndex >= maxGoals){
        stateQ.activeGoal = null;
        window.dispatchEvent(new CustomEvent('quest:allGoalsClear', { detail:{} }));
      } else {
        startGoal();
      }
    }

    // check mini
    if (checkMini(qState)){
      startMini(qState);
    }

    emitQuestUpdate(qState);
  }

  return { start, tick };
}