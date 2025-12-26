// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) for GoodJunk
// ✅ getUIState()
// ✅ onUpdate callback
// ✅ NEW: updateFromState(state) รองรับ defs แบบ label/targetByDiff/eval/pass

'use strict';

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];

  const maxGoals = Math.max(1, opts.maxGoals || 2);
  const maxMini  = Math.max(1, opts.maxMini  || 999);

  const onUpdate = (typeof opts.onUpdate === 'function') ? opts.onUpdate : null;

  const stateQ = {
    goalsAll: goalDefs.slice(0),
    minisAll: miniDefs.slice(0),

    goalIndex: 0,
    goalsTotal: Math.min(maxGoals, goalDefs.length || maxGoals),

    miniCount: 0,
    minisTotal: Math.min(maxMini, miniDefs.length || maxMini),

    activeGoal: null,
    activeMini: null,

    started: false,
    lastUpdateTs: 0
  };

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function normalize(def, isMini=false){
    if(!def) return null;

    const title = String(def.title ?? def.label ?? def.name ?? (isMini?'Mini':'Goal'));
    const kind  = String(def.kind ?? def.type ?? def.id ?? (isMini?'mini':'goal'));
    const target = Math.max(1, Number(def.target ?? def.max ?? def.count ?? 1) || 1);

    return {
      ...def,
      title,
      kind,
      target,
      cur: clamp(def.cur ?? 0, 0, target),
      done: false,
      // รองรับ eval/pass (optional)
      eval: (typeof def.eval === 'function') ? def.eval : null,
      pass: (typeof def.pass === 'function') ? def.pass : null,

      // mini timer fields (optional)
      timeLimitSec: (def.timeLimitSec != null) ? Math.max(0, Number(def.timeLimitSec)||0) : null,
      startedAt: null,
      tLeft: null
    };
  }

  function pickGoal(i){
    const def = stateQ.goalsAll[i] || stateQ.goalsAll[0] || null;
    return def ? normalize(def, false) : null;
  }

  function pickMini(i){
    const def = stateQ.minisAll[i] || stateQ.minisAll[0] || null;
    return def ? normalize(def, true) : null;
  }

  function fireUpdate(reason='update'){
    stateQ.lastUpdateTs = Date.now();
    if(onUpdate) {
      try { onUpdate(getUIState(reason)); } catch(_) {}
    }
  }

  function getUIState(reason='state'){
    const g = stateQ.activeGoal;
    const m = stateQ.activeMini;

    return {
      reason,

      goalTitle: g ? g.title : 'Goal: —',
      goalCur:   g ? (g.cur|0) : 0,
      goalMax:   g ? (g.target|0) : 0,

      miniTitle: m ? m.title : 'Mini: —',
      miniCur:   m ? (m.cur|0) : 0,
      miniMax:   m ? (m.target|0) : 0,
      miniTLeft: (m && m.tLeft != null) ? m.tLeft : null,

      goalIndex: Math.min(stateQ.goalIndex + 1, stateQ.goalsTotal),
      goalsTotal: stateQ.goalsTotal,
      miniIndex: Math.min(stateQ.miniCount + (m?1:0), stateQ.minisTotal),
      minisTotal: stateQ.minisTotal,

      diff
    };
  }

  function start(){
    if(stateQ.started) return;
    stateQ.started = true;
    stateQ.goalIndex = 0;
    stateQ.miniCount = 0;

    stateQ.activeGoal = pickGoal(stateQ.goalIndex);
    stateQ.activeMini = pickMini(0);

    if(stateQ.activeMini){
      stateQ.activeMini.startedAt = Date.now();
      if(stateQ.activeMini.timeLimitSec != null){
        stateQ.activeMini.tLeft = Math.ceil(stateQ.activeMini.timeLimitSec);
      }
    }

    fireUpdate('start');
  }

  function tick(){
    const m = stateQ.activeMini;
    if(!m) return;

    if(m.timeLimitSec != null && m.startedAt != null && !m.done){
      const t = (Date.now() - m.startedAt)/1000;
      const left = Math.max(0, m.timeLimitSec - t);
      const newLeft = Math.ceil(left);
      if(m.tLeft !== newLeft){
        m.tLeft = newLeft;
        fireUpdate('mini-tick');
      }
      if(left <= 0){
        failMini('timeout');
      }
    }
  }

  // ✅ NEW: อัปเดตความคืบหน้าจาก state ด้วย eval/pass
  function updateFromState(s = {}){
    let changed = false;

    const g = stateQ.activeGoal;
    if (g && !g.done && g.eval){
      const v = Number(g.eval(s)) || 0;
      const cur = clamp(v, 0, g.target);
      if (cur !== g.cur){ g.cur = cur; changed = true; }

      const ok = g.pass ? !!g.pass(g.cur, g.target) : (g.cur >= g.target);
      if (ok){
        g.done = true;
        fireUpdate('goal-complete');
        nextGoal();
        return; // goal เปลี่ยนแล้ว ออกจากรอบนี้
      }
    }

    const m = stateQ.activeMini;
    if (m && !m.done && m.eval){
      const v = Number(m.eval(s)) || 0;
      const cur = clamp(v, 0, m.target);
      if (cur !== m.cur){ m.cur = cur; changed = true; }

      const ok = m.pass ? !!m.pass(m.cur, m.target) : (m.cur >= m.target);
      if (ok){
        m.done = true;
        fireUpdate('mini-complete');
        nextMini();
        return;
      }
    }

    if (changed) fireUpdate('state-progress');
  }

  function addGoalProgress(n=1){
    const g = stateQ.activeGoal;
    if(!g || g.done) return { done:false };
    g.cur = clamp(g.cur + (Number(n)||0), 0, g.target);
    if(g.cur >= g.target){
      g.done = true;
      fireUpdate('goal-complete');
      return { done:true };
    }
    fireUpdate('goal-progress');
    return { done:false };
  }

  function addMiniProgress(n=1){
    const m = stateQ.activeMini;
    if(!m || m.done) return { done:false };
    m.cur = clamp(m.cur + (Number(n)||0), 0, m.target);
    if(m.cur >= m.target){
      m.done = true;
      fireUpdate('mini-complete');
      return { done:true };
    }
    fireUpdate('mini-progress');
    return { done:false };
  }

  function nextGoal(){
    stateQ.goalIndex += 1;
    if(stateQ.goalIndex >= stateQ.goalsTotal){
      stateQ.activeGoal = null;
      fireUpdate('all-goals-done');
      return { ended:true };
    }
    stateQ.activeGoal = pickGoal(stateQ.goalIndex);
    fireUpdate('next-goal');
    return { ended:false };
  }

  function nextMini(){
    stateQ.miniCount += 1;
    if(stateQ.miniCount >= stateQ.minisTotal){
      stateQ.activeMini = null;
      fireUpdate('all-minis-done');
      return { ended:true };
    }
    stateQ.activeMini = pickMini(stateQ.miniCount);
    if(stateQ.activeMini){
      stateQ.activeMini.startedAt = Date.now();
      if(stateQ.activeMini.timeLimitSec != null){
        stateQ.activeMini.tLeft = Math.ceil(stateQ.activeMini.timeLimitSec);
      }
    }
    fireUpdate('next-mini');
    return { ended:false };
  }

  function failMini(reason='fail'){
    const m = stateQ.activeMini;
    if(m && !m.done){
      m.done = true;
    }
    fireUpdate('mini-fail:'+reason);
    return nextMini();
  }

  return {
    start,
    tick,

    // แบบเดิม (นับ +1)
    addGoalProgress,
    addMiniProgress,

    // ✅ แบบใหม่ (ประเมินจาก state)
    updateFromState,

    nextGoal,
    nextMini,
    failMini,

    getUIState
  };
}