// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director — sequential goals + endless minis (robust)
// Emits: quest:update, quest:goalClear, quest:miniStart, quest:miniClear, quest:allGoalsClear

'use strict';

function clamp01(x){
  x = Number(x) || 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function pickFrom(list, usedSet){
  if (!Array.isArray(list) || list.length === 0) return null;
  // try not repeating too soon
  for (let i=0;i<12;i++){
    const it = list[(Math.random()*list.length)|0];
    if (!it || !it.id) continue;
    if (!usedSet || !usedSet.has(it.id)) return it;
  }
  return list[(Math.random()*list.length)|0] || null;
}

function okByChallenge(def, challenge){
  if (!def) return false;
  const ch = String(challenge||'rush').toLowerCase();
  if (Array.isArray(def.onlyChallenge) && def.onlyChallenge.length){
    return def.onlyChallenge.map(x=>String(x).toLowerCase()).includes(ch);
  }
  if (Array.isArray(def.notChallenge) && def.notChallenge.length){
    return !def.notChallenge.map(x=>String(x).toLowerCase()).includes(ch);
  }
  return true;
}

function targetOf(def, diff){
  const d = String(diff||'normal').toLowerCase();
  const tb = def && def.targetByDiff;
  if (tb && typeof tb === 'object'){
    return Number(tb[d] ?? tb.normal ?? tb.easy ?? tb.hard ?? def.target ?? 0) || 0;
  }
  return Number(def.target ?? 0) || 0;
}

function evalOf(def, s){
  try{
    if (typeof def.eval === 'function') return Number(def.eval(s)) || 0;
  }catch(_){}
  // fallback common keys
  if (def && def.key) return Number(s?.[def.key]) || 0;
  return 0;
}

function passOf(def, v, tgt, s){
  try{
    if (typeof def.pass === 'function') return !!def.pass(v, tgt, s);
  }catch(_){}
  return v >= tgt;
}

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();

  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];

  const maxGoals = Math.max(1, opts.maxGoals || 2);
  const maxMini  = Math.max(1, opts.maxMini  || 999);

  const stateQ = {
    started:false,

    // pools
    goalsAll: goalDefs.slice(0),
    minisAll: miniDefs.slice(0),

    // progress meta
    goalsCleared:0,
    minisCleared:0,
    goalIndex:0,
    miniCount:0,

    // active
    activeGoal:null,
    activeMini:null,

    // anti-repeat
    usedGoals: new Set(),
    usedMinis: new Set(),

    // last payload (avoid spam)
    lastGoalPct:-1,
    lastMiniPct:-1,
    lastEmitAt:0
  };

  function pickGoal(){
    // filter by challenge first
    const list = stateQ.goalsAll.filter(g => okByChallenge(g, challenge));
    const g = pickFrom(list, stateQ.usedGoals);
    if (g && g.id) stateQ.usedGoals.add(g.id);
    return g;
  }

  function pickMini(){
    const list = stateQ.minisAll.filter(m => okByChallenge(m, challenge));
    const m = pickFrom(list, stateQ.usedMinis);
    if (m && m.id) stateQ.usedMinis.add(m.id);
    return m;
  }

  function startMini(s){
    stateQ.activeMini = pickMini();
    stateQ.miniCount = (stateQ.miniCount|0) + 1;

    emit('quest:miniStart', {
      id: stateQ.activeMini?.id || '',
      title: stateQ.activeMini?.label || '',
      miniCount: stateQ.miniCount|0
    });

    // immediate update
    updateEmit(s, true);
  }

  function startGoal(s){
    stateQ.activeGoal = pickGoal();
    stateQ.goalIndex = (stateQ.goalIndex|0) + 1;
    updateEmit(s, true);
  }

  function updateEmit(s, force=false){
    const now = Date.now();
    if (!force && now - stateQ.lastEmitAt < 110) return;

    const goal = stateQ.activeGoal;
    const mini = stateQ.activeMini;

    let goalOut = null;
    if (goal){
      const tgt = targetOf(goal, diff);
      const cur = evalOf(goal, s);
      const pct = (tgt > 0) ? clamp01(cur / tgt) : 0;
      goalOut = {
        id: goal.id || '',
        title: goal.label || 'ภารกิจหลัก',
        cur: (goal.id === 'g3') ? Math.min(cur, tgt) : cur,
        max: tgt,
        pct,
        hint: goal.hint || ''
      };
      stateQ.lastGoalPct = pct;
    }

    let miniOut = null;
    if (mini){
      const tgt = targetOf(mini, diff);
      const cur = evalOf(mini, s);
      const pct = (tgt > 0) ? clamp01(cur / tgt) : 0;
      miniOut = {
        id: mini.id || '',
        title: mini.label || 'Mini quest',
        cur,
        max: tgt,
        pct,
        hint: mini.hint || ''
      };
      stateQ.lastMiniPct = pct;
    }

    const meta = {
      goalsCleared: stateQ.goalsCleared|0,
      minisCleared: stateQ.minisCleared|0,
      goalIndex: stateQ.goalIndex|0,
      miniCount: stateQ.miniCount|0,
      diff,
      challenge
    };

    emit('quest:update', { goal: goalOut, mini: miniOut, meta });
    stateQ.lastEmitAt = now;
  }

  function tick(s){
    if (!stateQ.started) return;

    // 1) goals
    if (stateQ.activeGoal){
      const g = stateQ.activeGoal;
      const tgt = targetOf(g, diff);
      const cur = evalOf(g, s);
      const pass = passOf(g, cur, tgt, s);

      if (pass){
        stateQ.goalsCleared = (stateQ.goalsCleared|0) + 1;
        emit('quest:goalClear', { id:g.id||'', title:g.label||'', goalsCleared: stateQ.goalsCleared|0 });

        if (stateQ.goalsCleared >= maxGoals){
          stateQ.activeGoal = null;
          emit('quest:allGoalsClear', { goalsCleared: stateQ.goalsCleared|0 });
        }else{
          startGoal(s);
        }
      }
    } else {
      // no active goal -> keep showing "completed"
    }

    // 2) minis (endless chain until maxMini reached)
    if (stateQ.activeMini){
      const m = stateQ.activeMini;
      const tgt = targetOf(m, diff);
      const cur = evalOf(m, s);
      const pass = passOf(m, cur, tgt, s);

      if (pass){
        stateQ.minisCleared = (stateQ.minisCleared|0) + 1;
        emit('quest:miniClear', { id:m.id||'', title:m.label||'', minisCleared: stateQ.minisCleared|0 });

        if (stateQ.miniCount >= maxMini){
          stateQ.activeMini = null;
        }else{
          startMini(s);
        }
      }
    } else {
      // if mini ended, start another (unless hit cap)
      if (stateQ.miniCount < maxMini){
        startMini(s);
      }
    }

    updateEmit(s, false);
  }

  function start(s){
    if (stateQ.started) return;
    stateQ.started = true;

    stateQ.goalsCleared = 0;
    stateQ.minisCleared = 0;
    stateQ.goalIndex = 0;
    stateQ.miniCount = 0;
    stateQ.usedGoals.clear();
    stateQ.usedMinis.clear();

    startGoal(s);
    startMini(s);

    updateEmit(s, true);
  }

  return {
    start,
    tick,
    getState(){
      return {
        started: stateQ.started,
        goalsCleared: stateQ.goalsCleared|0,
        minisCleared: stateQ.minisCleared|0,
        goalIndex: stateQ.goalIndex|0,
        miniCount: stateQ.miniCount|0,
        activeGoal: stateQ.activeGoal ? { id: stateQ.activeGoal.id, label: stateQ.activeGoal.label } : null,
        activeMini: stateQ.activeMini ? { id: stateQ.activeMini.id, label: stateQ.activeMini.label } : null
      };
    }
  };
}