// === /herohealth/vr-goodjunk/quest-director-goodjunk.js ===
// GoodJunk Quest Director — COMPAT LAYER
// Emits: quest:miniStart, quest:goalClear, quest:miniClear, quest:update
// ✅ meta now includes goalsCleared + goalIndex (total goals) for your UI

'use strict';

const clamp01 = x => Math.max(0, Math.min(1, Number(x||0)));
const emit = (n,d)=>window.dispatchEvent(new CustomEvent(n,{detail:d}));

function targetOf(def, diff){
  const d = String(diff||'normal').toLowerCase();
  const t1 = def && def.targetByDiff;
  if (t1 && (t1[d] != null || t1.normal != null)) return Number(t1[d] ?? t1.normal ?? 0) || 0;

  const t2 = def && def.byDiff;
  if (t2 && (t2[d] != null || t2.normal != null)) return Number(t2[d] ?? t2.normal ?? Object.values(t2)[0] ?? 0) || 0;

  if (def && def.value != null) return Number(def.value) || 0;
  return 0;
}

function normalizeDef(def){
  if (!def) return null;

  if (typeof def.eval === 'function' && typeof def.pass === 'function'){
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

  const evalFn = (s)=>{
    if (!s) return 0;
    if (type === 'scoreAtLeast') return (s.score|0);
    if (type === 'goodHitsAtLeast') return (s.goodHits|0);
    if (type === 'streakGood') return (s.streakGood|0);
    if (type === 'goldHitOnce') return (s.goldHitsThisMini ? 1 : 0);
    if (type === 'blocksAtLeast') return (s.blocks|0);
    if (type) return (s[type]|0);
    return 0;
  };

  const passFn = (v, t)=> (Number(v)||0) >= (Number(t)||0);

  return { id, label, eval: evalFn, pass: passFn, targetByDiff:def.targetByDiff, byDiff:def.byDiff, value:def.value };
}

export function makeGoodJunkQuestDirector(opts){
  const diff = String(opts?.diff || 'normal').toLowerCase();

  const goalsIn = (opts.goals || opts.goalDefs || []);
  const minisIn = (opts.minis || opts.miniDefs || []);

  const goals = (Array.isArray(goalsIn) ? goalsIn : []).map(normalizeDef).filter(Boolean);
  const minis = (Array.isArray(minisIn) ? minisIn : []).map(normalizeDef).filter(Boolean);

  const S={
    goalIndex:0,
    activeGoal:null,
    activeMini:null,
    minisCleared:0,
    miniCount:0
  };

  function startGoal(s){
    S.activeGoal = goals[S.goalIndex] || null;
  }

  function startMini(){
    if (!minis.length){ S.activeMini = null; return; }
    S.activeMini = minis[S.miniCount % minis.length] || null;
    S.miniCount++;
    emit('quest:miniStart', { id:S.activeMini?.id, title:S.activeMini?.label });
  }

  function update(s){
    const g=S.activeGoal, m=S.activeMini;

    const goalOut = g ? (() => {
      const t = Math.max(1, targetOf(g, diff));
      const v = Number(g.eval(s)) || 0;
      return { title:g.label, cur:v, max:t, pct: clamp01(v/t) };
    })() : null;

    const miniOut = m ? (() => {
      const t = Math.max(1, targetOf(m, diff));
      const v = Number(m.eval(s)) || 0;
      return { title:m.label, cur:v, max:t, pct: clamp01(v/t) };
    })() : null;

    emit('quest:update', {
      goal: goalOut,
      mini: miniOut,
      meta: {
        goalsCleared: (S.goalIndex|0),
        goalIndex: (goals.length|0),
        minisCleared: (S.minisCleared|0),
        miniCount: (S.miniCount|0)
      }
    });
  }

  function tick(s){
    if (!goals.length && !minis.length){
      emit('quest:update', { goal:null, mini:null, meta:{ goalsCleared:0, goalIndex:0, minisCleared:0, miniCount:0 }, questOk:false });
      return;
    }

    if (S.activeGoal){
      const t = Math.max(1, targetOf(S.activeGoal, diff));
      const v = Number(S.activeGoal.eval(s)) || 0;
      if (S.activeGoal.pass(v, t, s)){
        emit('quest:goalClear', { title:S.activeGoal.label, id:S.activeGoal.id });
        S.goalIndex++;
        startGoal(s);
        if (!S.activeGoal) emit('quest:allGoalsClear', {});
      }
    }

    if (S.activeMini){
      const t = Math.max(1, targetOf(S.activeMini, diff));
      const v = Number(S.activeMini.eval(s)) || 0;
      if (S.activeMini.pass(v, t, s)){
        S.minisCleared++;
        emit('quest:miniClear', { title:S.activeMini.label, id:S.activeMini.id, minisCleared:S.minisCleared|0 });
        startMini();
      }
    }

    update(s);
  }

  function start(s){
    S.goalIndex = 0;
    S.minisCleared = 0;
    S.miniCount = 0;

    startGoal(s);
    startMini();
    update(s);
  }

  function getActive(){
    const s = window.__GJ_QSTATE__ || {};
    const g = S.activeGoal ? (() => {
      const t = Math.max(1, targetOf(S.activeGoal, diff));
      const v = Number(S.activeGoal.eval(s)) || 0;
      return { title:S.activeGoal.label, cur:v, max:t, pct:clamp01(v/t) };
    })() : null;

    const m = S.activeMini ? (() => {
      const t = Math.max(1, targetOf(S.activeMini, diff));
      const v = Number(S.activeMini.eval(s)) || 0;
      return { title:S.activeMini.label, cur:v, max:t, pct:clamp01(v/t) };
    })() : null;

    return { goal:g, mini:m, meta:{ goalsCleared:S.goalIndex|0, goalIndex:goals.length|0, minisCleared:S.minisCleared|0, miniCount:S.miniCount|0 } };
  }

  return { start, tick, getActive };
}

export const makeQuestDirector = makeGoodJunkQuestDirector;