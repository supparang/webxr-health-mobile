// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director v2 (รองรับ schema แบบ eval/pass/targetByDiff + onlyChallenge/notChallenge)
// Goals sequential + Minis chain

'use strict';

function normDiff(v){
  v = String(v || 'normal').toLowerCase();
  return (v === 'easy' || v === 'normal' || v === 'hard') ? v : 'normal';
}

function allowedByChallenge(def, challenge){
  const ch = String(challenge || 'rush').toLowerCase();
  if (Array.isArray(def.onlyChallenge) && def.onlyChallenge.length){
    return def.onlyChallenge.includes(ch);
  }
  if (Array.isArray(def.notChallenge) && def.notChallenge.length){
    return !def.notChallenge.includes(ch);
  }
  return true;
}

function pickUnique(defs, n, challenge){
  const arr = defs.filter(d => d && allowedByChallenge(d, challenge)).slice();
  const out = [];
  while (arr.length && out.length < n){
    const i = (Math.random()*arr.length)|0;
    out.push(arr.splice(i,1)[0]);
  }
  return out;
}

function targetFor(def, diff){
  const d = normDiff(diff);
  if (def.targetByDiff && def.targetByDiff[d] != null) return (def.targetByDiff[d] | 0) || 1;
  if (typeof def.makeTarget === 'function') return (def.makeTarget(d) | 0) || 1;
  return 1;
}

function evalProg(def, gameState, target){
  if (typeof def.eval === 'function') return def.eval(gameState, target) | 0;
  if (typeof def.calc === 'function'){
    const r = def.calc(gameState, target) || {};
    return (r.prog|0);
  }
  return 0;
}

function passProg(def, prog, target){
  if (typeof def.pass === 'function') return !!def.pass(prog, target);
  // fallback
  return (target > 0) ? (prog >= target) : false;
}

export function makeQuestDirector(opts = {}) {
  const diff = normDiff(opts.diff);
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];
  const maxGoals = Math.max(1, opts.maxGoals || 2);
  const maxMini  = Math.max(1, opts.maxMini  || 999);

  const stateQ = {
    goalsAll: [],
    minisAll: [],
    goalIndex: 0,
    miniCount: 0,
    activeMini: null,
    activeGoal: null,
    started: false
  };

  function emit(detail){
    window.dispatchEvent(new CustomEvent('quest:update',{ detail }));
  }

  function newQ(def){
    const target = targetFor(def, diff);
    return {
      id:def.id, label:def.label || def.id,
      target, prog:0, done:false,
      hint: def.hint || ''
    };
  }

  function buildPayload(hint=''){
    const g = (stateQ.activeGoal && !stateQ.activeGoal.done) ? stateQ.activeGoal : null;
    const m = (stateQ.activeMini && !stateQ.activeMini.done) ? stateQ.activeMini : null;
    return { goal:g, mini:m, goalsAll:stateQ.goalsAll, minisAll:stateQ.minisAll, hint };
  }

  function start(gameState){
    stateQ.started = true;

    // goals ทั้งเกม (สุ่ม unique)
    const pickedGoals = pickUnique(goalDefs, maxGoals, challenge);
    stateQ.goalsAll = pickedGoals.map(def => newQ(def));
    stateQ.goalIndex = 0;
    stateQ.activeGoal = stateQ.goalsAll[0] || null;

    // mini chain
    stateQ.minisAll = [];
    stateQ.miniCount = 0;
    stateQ.activeMini = null;
    nextMini(gameState);

    emit(buildPayload('เริ่มภารกิจ!'));
  }

  function nextGoal(){
    stateQ.goalIndex++;
    stateQ.activeGoal = stateQ.goalsAll[stateQ.goalIndex] || null;
  }

  function nextMini(gameState){
    if (stateQ.miniCount >= maxMini) { stateQ.activeMini = null; return; }

    // pick a random mini that is allowed by challenge
    const pool = miniDefs.filter(d => d && allowedByChallenge(d, challenge));
    if (!pool.length){ stateQ.activeMini = null; return; }

    const def = pool[(Math.random()*pool.length)|0];
    const m = newQ(def);
    stateQ.activeMini = m;
    stateQ.minisAll.push(m);
    stateQ.miniCount++;

    window.dispatchEvent(new CustomEvent('quest:miniStart', { detail:{ id:m.id }}));
    emit(buildPayload('Mini ใหม่มาแล้ว!'));
  }

  function update(gameState){
    if (!stateQ.started) return;

    // GOAL
    if (stateQ.activeGoal){
      const g = stateQ.activeGoal;
      const def = goalDefs.find(d=>d && d.id===g.id);
      if (def){
        const tgt = targetFor(def, diff);
        g.target = tgt;
        g.prog = evalProg(def, gameState, tgt);
        g.done = passProg(def, g.prog, tgt);

        if (g.done){
          emit(buildPayload('GOAL CLEAR!'));
          nextGoal();
        }
      }
    }

    // MINI
    if (stateQ.activeMini){
      const m = stateQ.activeMini;
      const def = miniDefs.find(d=>d && d.id===m.id);
      if (def){
        const tgt = targetFor(def, diff);
        m.target = tgt;
        m.prog = evalProg(def, gameState, tgt);
        m.done = passProg(def, m.prog, tgt);

        if (m.done){
          emit(buildPayload('MINI CLEAR!'));
          nextMini(gameState);
          return;
        }
      }
    }

    // hint (เอาจาก def.hint เป็นหลัก)
    let hint = '';
    if (stateQ.activeGoal){
      const def = goalDefs.find(d=>d && d.id===stateQ.activeGoal.id);
      hint = (def && def.hint) ? def.hint : '';
    }
    emit(buildPayload(hint));
  }

  function finalize(_gameState){
    const goalsCleared = stateQ.goalsAll.filter(x=>x.done).length;
    const goalsTotal   = stateQ.goalsAll.length;
    const miniCleared  = stateQ.minisAll.filter(x=>x.done).length;
    const miniTotal    = stateQ.minisAll.length;
    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  return { start, update, finalize };
}