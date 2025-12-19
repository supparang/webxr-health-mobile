// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) for GoodJunk
// ✅ รองรับ schema ใหม่: targetByDiff / eval / pass / onlyChallenge / notChallenge
// ✅ ทำงานแบบ "เกมจริง": เลือกภารกิจที่เข้ากับ challenge, ข้ามที่ใช้ไม่ได้, chain mini ต่อเนื่อง
// ✅ emit quest:update + quest:miniStart

'use strict';

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
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

  function pickTargetsByDiff(def){
    if (!def || !def.targetByDiff) return 1;
    const t = def.targetByDiff[diff];
    return (Number(t) > 0 ? (t|0) : 1);
  }

  function eligible(def, gameState){
    const ch = String(gameState?.challenge || '').toLowerCase();

    if (Array.isArray(def.onlyChallenge) && def.onlyChallenge.length){
      if (!def.onlyChallenge.map(x=>String(x).toLowerCase()).includes(ch)) return false;
    }
    if (Array.isArray(def.notChallenge) && def.notChallenge.length){
      if (def.notChallenge.map(x=>String(x).toLowerCase()).includes(ch)) return false;
    }
    return true;
  }

  function newGoal(def){
    const target = pickTargetsByDiff(def);
    return {
      id:def.id,
      label:def.label || 'Goal',
      hint:def.hint || '',
      target,
      prog:0,
      done:false,
      hold: !!def.hold,     // ถ้าคุณอยากทำ hold-goal ในอนาคต
      limit: def.limitByDiff ? (def.limitByDiff[diff]|0) : null
    };
  }

  function newMini(def){
    const target = pickTargetsByDiff(def);
    return {
      id:def.id,
      label:def.label || 'Mini',
      hint:def.hint || '',
      target,
      prog:0,
      done:false,
      startedAt: Date.now()
    };
  }

  function pickUniqueEligible(defs, n, gameState){
    const pool = defs.filter(d => d && eligible(d, gameState));
    const arr = pool.slice();
    const out = [];
    while (arr.length && out.length < n){
      const i = (Math.random()*arr.length)|0;
      out.push(arr.splice(i,1)[0]);
    }
    return out;
  }

  function buildPayload(hint=''){
    const g = stateQ.activeGoal && !stateQ.activeGoal.done ? stateQ.activeGoal : null;
    const m = stateQ.activeMini && !stateQ.activeMini.done ? stateQ.activeMini : null;

    return {
      goal: g,
      mini: m,
      goalsAll: stateQ.goalsAll,
      minisAll: stateQ.minisAll,
      hint
    };
  }

  function computeProgress(def, gameState, current){
    // schema ใหม่: eval / pass
    const v = (typeof def.eval === 'function') ? def.eval(gameState, current?.target) : 0;
    const prog = (Number(v) || 0) | 0;
    const target = (current?.target|0) || pickTargetsByDiff(def);
    const pass = (typeof def.pass === 'function') ? !!def.pass(prog, target, gameState) : (prog >= target);
    return { prog, target, pass };
  }

  function start(gameState){
    stateQ.started = true;

    // เลือก goals ที่ "ใช้ได้จริง" กับ challenge นี้
    const pickedGoals = pickUniqueEligible(goalDefs, maxGoals, gameState);
    stateQ.goalsAll = pickedGoals.map(def => newGoal(def));
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

    // เลือก mini ที่ใช้ได้กับ challenge นี้
    const pool = miniDefs.filter(d => d && eligible(d, gameState));
    if (!pool.length){ stateQ.activeMini = null; return; }

    const def = pool[(Math.random()*pool.length)|0];
    const m = newMini(def);

    stateQ.activeMini = m;
    stateQ.minisAll.push(m);
    stateQ.miniCount++;

    window.dispatchEvent(new CustomEvent('quest:miniStart', { detail:{ id:m.id }}));
    emit(buildPayload('Mini ใหม่มาแล้ว!'));
  }

  function update(gameState){
    if (!stateQ.started) return;

    // ----- GOAL -----
    if (stateQ.activeGoal){
      const g = stateQ.activeGoal;
      const def = goalDefs.find(d=>d.id===g.id);

      if (!def){
        g.done = true;
        nextGoal();
      } else if (!eligible(def, gameState)){
        g.done = true;
        nextGoal();
      } else {
        const r = computeProgress(def, gameState, g);
        g.prog = r.prog;
        g.target = r.target;
        g.done = r.pass;

        if (g.done){
          emit(buildPayload('GOAL CLEAR!'));
          nextGoal();
        }
      }
    }

    // ----- MINI -----
    if (stateQ.activeMini){
      const m = stateQ.activeMini;
      const def = miniDefs.find(d=>d.id===m.id);

      if (!def){
        m.done = true;
        nextMini(gameState);
        return;
      }
      if (!eligible(def, gameState)){
        m.done = true; // ข้ามแบบแฟร์
        nextMini(gameState);
        return;
      }

      const r = computeProgress(def, gameState, m);
      m.prog = r.prog;
      m.target = r.target;
      m.done = r.pass;

      if (m.done){
        emit(buildPayload('MINI CLEAR!'));
        nextMini(gameState);
        return;
      }
    }

    // hint เฉพาะกิจ (อยากใส่เพิ่มได้)
    emit(buildPayload(''));
  }

  function finalize(gameState){
    // goals
    const goalsCleared = stateQ.goalsAll.filter(x=>x && x.done).length;
    const goalsTotal   = stateQ.goalsAll.length;

    // minis
    const miniCleared  = stateQ.minisAll.filter(x=>x && x.done).length;
    const miniTotal    = stateQ.minisAll.length;

    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  return { start, update, finalize };
}