// === /herohealth/vr/modes/quest-director.js ===
// Universal Quest Director (Goals sequential + Minis chain)
// ✅ supports: {id,label,targetByDiff,eval,pass,when,timeLimitSec,forbidJunk}
// ✅ emits UI state via onUpdate callback
// ✅ throttled updates (only when state changed / tLeft changed)

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function toStr(v, d=''){ return (v==null)?d:String(v); }

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function targetFromDef(def, diff){
  const d = String(diff||'normal').toLowerCase();
  if(def && def.targetByDiff && def.targetByDiff[d] != null) return Math.max(1, Number(def.targetByDiff[d])||1);
  if(def && def.target != null) return Math.max(1, Number(def.target)||1);
  if(def && def.max != null) return Math.max(1, Number(def.max)||1);
  if(def && def.count != null) return Math.max(1, Number(def.count)||1);
  return 1;
}

function normalize(def, diff, kindFallback){
  const id = toStr(def.id, '');
  const label = toStr(def.label ?? def.title ?? def.name, kindFallback || 'Quest');
  const target = targetFromDef(def, diff);

  const evalFn = (typeof def.eval === 'function') ? def.eval : (s=>Number(s?.value||0)||0);
  const passFn = (typeof def.pass === 'function') ? def.pass : ((v,t)=>v>=t);

  const when = toStr(def.when, 'live'); // live | end
  const timeLimitSec = (def.timeLimitSec != null) ? Math.max(0, Number(def.timeLimitSec)||0) : null;
  const forbidJunk = !!def.forbidJunk;

  return {
    ...def,
    id, label, target,
    evalFn, passFn,
    when, timeLimitSec, forbidJunk,
    cur: 0,
    done: false,
    startedAt: null,
    tLeft: null
  };
}

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];

  const maxGoals = Math.max(1, opts.maxGoals || 2);
  const maxMini  = Math.max(1, opts.maxMini  || 3);

  const onUpdate = (typeof opts.onUpdate === 'function') ? opts.onUpdate : null;

  const Q = {
    started: false,

    goals: [],
    minis: [],

    goalIndex: 0,
    miniIndex: 0,

    goalsTotal: 0,
    minisTotal: 0,

    goalsCleared: 0,
    minisCleared: 0,

    activeGoal: null,
    activeMini: null,

    _lastSig: '',
  };

  function ui(reason='update'){
    const g = Q.activeGoal;
    const m = Q.activeMini;

    return {
      reason,
      diff,

      goalTitle: g ? `Goal: ${g.label}` : 'Goal: —',
      goalCur: g ? (g.cur|0) : 0,
      goalMax: g ? (g.target|0) : 0,

      miniTitle: m ? `Mini: ${m.label}` : 'Mini: —',
      miniCur: m ? (m.cur|0) : 0,
      miniMax: m ? (m.target|0) : 0,
      miniTLeft: (m && m.tLeft != null) ? m.tLeft : null,

      goalsCleared: Q.goalsCleared|0,
      goalsTotal: Q.goalsTotal|0,
      minisCleared: Q.minisCleared|0,
      minisTotal: Q.minisTotal|0,

      goalIndex: Math.min(Q.goalIndex + 1, Math.max(1,Q.goalsTotal|0)),
      miniIndex: (Q.activeMini ? Math.min(Q.miniIndex + 1, Math.max(1,Q.minisTotal|0)) : (Q.miniIndex|0)),
    };
  }

  function push(reason='update', force=false){
    if(!onUpdate) return;
    const u = ui(reason);

    // signature => กันยิงถี่เกิน
    const sig = [
      u.goalCur,u.goalMax,u.goalIndex,u.goalsCleared,u.goalsTotal,
      u.miniCur,u.miniMax,u.miniIndex,u.minisCleared,u.minisTotal,
      (u.miniTLeft==null?'_':u.miniTLeft),
      u.goalTitle,u.miniTitle
    ].join('|');

    if(!force && sig === Q._lastSig) return;
    Q._lastSig = sig;

    try { onUpdate(u); } catch(_) {}
  }

  function start(){
    if(Q.started) return;
    Q.started = true;

    // เลือกเควสต์แบบสุ่มตาม max*
    Q.goals = shuffle(goalDefs).slice(0, Math.min(maxGoals, goalDefs.length || maxGoals))
      .map(d=>normalize(d, diff, 'Goal'));
    Q.minis = shuffle(miniDefs).slice(0, Math.min(maxMini, miniDefs.length || maxMini))
      .map(d=>normalize(d, diff, 'Mini'));

    Q.goalsTotal = Math.max(1, Q.goals.length);
    Q.minisTotal = Math.max(1, Q.minis.length);

    Q.goalIndex = 0;
    Q.miniIndex = 0;
    Q.goalsCleared = 0;
    Q.minisCleared = 0;

    Q.activeGoal = Q.goals[0] || null;
    Q.activeMini = Q.minis[0] || null;

    if(Q.activeMini){
      Q.activeMini.startedAt = Date.now();
      if(Q.activeMini.timeLimitSec != null){
        Q.activeMini.tLeft = Math.ceil(Q.activeMini.timeLimitSec);
      }
    }

    push('start', true);
  }

  function nextGoal(){
    Q.goalIndex++;
    if(Q.goalIndex >= Q.goalsTotal){
      Q.activeGoal = null;
      push('all-goals-done', true);
      return { ended:true };
    }
    Q.activeGoal = Q.goals[Q.goalIndex] || null;
    push('next-goal', true);
    return { ended:false };
  }

  function nextMini(){
    Q.miniIndex++;
    if(Q.miniIndex >= Q.minisTotal){
      Q.activeMini = null;
      push('all-minis-done', true);
      return { ended:true };
    }
    Q.activeMini = Q.minis[Q.miniIndex] || null;
    if(Q.activeMini){
      Q.activeMini.startedAt = Date.now();
      if(Q.activeMini.timeLimitSec != null){
        Q.activeMini.tLeft = Math.ceil(Q.activeMini.timeLimitSec);
      } else {
        Q.activeMini.tLeft = null;
      }
    }
    push('next-mini', true);
    return { ended:false };
  }

  function failMini(reason='fail'){
    const m = Q.activeMini;
    if(m && !m.done) m.done = true;
    push('mini-fail:'+reason, true);
    return nextMini();
  }

  function onJunkHit(meta = {}) {
    const guarded = !!meta.guarded; // ✅ fair: guarded = ไม่ fail
    const m = Q.activeMini;
    if(m && !m.done && m.forbidJunk && !guarded){
      failMini('hit-junk');
    }
  }

  function tick(){
    const m = Q.activeMini;
    if(!m || m.done) return;

    if(m.timeLimitSec != null && m.startedAt != null){
      const t = (Date.now() - m.startedAt) / 1000;
      const left = Math.max(0, m.timeLimitSec - t);
      const ceil = Math.ceil(left);

      if(m.tLeft !== ceil){
        m.tLeft = ceil;
        push('mini-tick', false);
      }
      if(left <= 0){
        failMini('timeout');
      }
    }
  }

  // อัปเดตความคืบหน้า “จาก state ภายนอก” ผ่าน eval/pass
  function updateFromState(state = {}, reason='state'){
    if(!Q.started) return;

    // Goal (live)
    const g = Q.activeGoal;
    if(g && !g.done && String(g.when||'live') !== 'end'){
      const v = clamp(g.evalFn(state), 0, 1e9);
      g.cur = v|0;
      if(g.passFn(v, g.target)){
        g.done = true;
        Q.goalsCleared++;
        push('goal-complete', true);
        nextGoal();
      } else {
        push('goal-progress', false);
      }
    }

    // Mini (live)
    const m = Q.activeMini;
    if(m && !m.done){
      const v = clamp(m.evalFn(state), 0, 1e9);
      m.cur = v|0;
      if(m.passFn(v, m.target)){
        m.done = true;
        Q.minisCleared++;
        push('mini-complete', true);
        nextMini();
      } else {
        push('mini-progress', false);
      }
    }

    // reason for outside trace (optional)
    if(reason) { /* no-op */ }
  }

  // ใช้ตอนจบเกม (ประเมิน goal ที่ when:'end')
  function finalize(state = {}){
    const g = Q.activeGoal;
    if(g && !g.done && String(g.when||'live') === 'end'){
      const v = clamp(g.evalFn(state), 0, 1e9);
      g.cur = v|0;
      if(g.passFn(v, g.target)){
        g.done = true;
        Q.goalsCleared++;
        push('goal-complete-end', true);
        nextGoal();
      } else {
        push('goal-end-fail', true);
      }
    }
    push('finalize', true);
  }

  function getUIState(reason='state'){ return ui(reason); }

  return {
    start,
    tick,
    updateFromState,
    finalize,
    onJunkHit,
    nextGoal,
    nextMini,
    failMini,
    getUIState
  };
}

export default { makeQuestDirector };