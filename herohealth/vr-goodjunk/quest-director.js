// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (GoodJunkVR-compatible)
// - Emits: window.dispatchEvent('quest:update', { goal, mini, goalsAll, minisAll, hint })
// - Supports: continuous mini quests (ทำจบแล้วสุ่มอันต่อไปเรื่อย ๆ จนจบเกม)
// - Works with your HTML HUD fields exactly

'use strict';

function clamp01(x){ x = Number(x)||0; return Math.max(0, Math.min(1, x)); }
function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function pickUnique(list, n, rng=Math.random){
  const src = Array.isArray(list) ? list.slice() : [];
  // shuffle
  for (let i = src.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    const tmp = src[i]; src[i] = src[j]; src[j] = tmp;
  }
  return src.slice(0, Math.max(0, Math.min(n, src.length)));
}

function normalizeDef(def){
  // def schema:
  // { id, label, hint, target, getProg(state, ctx) -> number, isDone?(prog,target,state,ctx)->bool, capProg?:bool }
  if (!def || typeof def !== 'object') return null;
  const out = { ...def };

  out.id = String(out.id || out.key || out.label || ('q_' + Math.random().toString(16).slice(2)));
  out.label = String(out.label || 'ภารกิจ');
  out.hint  = String(out.hint || '');
  out.target = Math.max(1, (out.target|0) || 1);

  if (typeof out.getProg !== 'function'){
    // fallback: read state[out.metric]
    const metric = String(out.metric || '');
    out.getProg = (state)=> (state && metric ? (state[metric]||0) : 0);
  }

  if (typeof out.isDone !== 'function'){
    out.isDone = (prog, target)=> (prog >= target);
  }

  out.capProg = (out.capProg !== false); // default true
  return out;
}

function computeProgress(def, state, ctx){
  const target = def.target|0;
  let prog = 0;
  try{
    prog = Number(def.getProg(state, ctx)) || 0;
  }catch(_e){ prog = 0; }

  if (def.capProg) prog = Math.min(prog, target);
  const done = !!def.isDone(prog, target, state, ctx);

  return { prog: prog|0, target: target|0, done };
}

export function makeQuestDirector(opts={}){
  const diff = String(opts.diff || 'normal').toLowerCase();

  const goalDefsAll = (opts.goalDefs || []).map(normalizeDef).filter(Boolean);
  const miniDefsAll = (opts.miniDefs || []).map(normalizeDef).filter(Boolean);

  const maxGoals = Math.max(1, (opts.maxGoals|0) || 2);
  const maxMini  = Math.max(1, (opts.maxMini|0) || 3);

  // ทำ mini ต่อเนื่องเรื่อย ๆ (ตรงกับที่คุณต้องการ)
  const continuousMini = (opts.continuousMini !== false);

  // internal
  const ctx = {
    diff,
    startedAtMs: 0,
    lastEmitMs: 0,
    emitEveryMs: 120, // กัน spam แต่ยังลื่น
    state: null
  };

  let goalsAll = []; // [{def, prog,target,done}]
  let minisAll = []; // [{def, prog,target,done}]
  let remainingMiniPool = [];

  function emitUpdate(force=false){
    const t = nowMs();
    if (!force && (t - ctx.lastEmitMs) < ctx.emitEveryMs) return;
    ctx.lastEmitMs = t;

    // current goal/mini = อันแรกที่ยังไม่ done
    const curGoalObj = goalsAll.find(g => g && !g.done) || goalsAll[0] || null;
    const curMiniObj = minisAll.find(m => m && !m.done) || minisAll[0] || null;

    const goal = curGoalObj ? {
      id: curGoalObj.def.id,
      label: curGoalObj.def.label,
      hint: curGoalObj.def.hint || '',
      prog: curGoalObj.prog|0,
      target: curGoalObj.target|0,
      done: !!curGoalObj.done
    } : null;

    const mini = curMiniObj ? {
      id: curMiniObj.def.id,
      label: curMiniObj.def.label,
      hint: curMiniObj.def.hint || '',
      prog: curMiniObj.prog|0,
      target: curMiniObj.target|0,
      done: !!curMiniObj.done
    } : null;

    const hint = (mini && mini.hint) ? mini.hint : (goal && goal.hint) ? goal.hint : '';

    ROOT.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal,
        mini,
        goalsAll: goalsAll.map(g => g ? ({
          id:g.def.id, label:g.def.label, prog:g.prog|0, target:g.target|0, done:!!g.done
        }) : null).filter(Boolean),
        minisAll: minisAll.map(m => m ? ({
          id:m.def.id, label:m.def.label, prog:m.prog|0, target:m.target|0, done:!!m.done
        }) : null).filter(Boolean),
        hint
      }
    }));
  }

  function refreshAllProgress(){
    if (!ctx.state) return;

    let changed = false;

    // goals
    for (const g of goalsAll){
      const beforeDone = !!g.done;
      const beforeProg = g.prog|0;

      const r = computeProgress(g.def, ctx.state, ctx);
      g.prog = r.prog|0;
      g.target = r.target|0;
      g.done = !!r.done;

      if (beforeDone !== g.done || beforeProg !== g.prog) changed = true;
    }

    // minis
    for (const m of minisAll){
      const beforeDone = !!m.done;
      const beforeProg = m.prog|0;

      const r = computeProgress(m.def, ctx.state, ctx);
      m.prog = r.prog|0;
      m.target = r.target|0;
      m.done = !!r.done;

      if (beforeDone !== m.done || beforeProg !== m.prog) changed = true;
    }

    // ถ้า mini ทำเสร็จแล้ว และต้องการ “ต่อภารกิจย่อยไปเรื่อย ๆ”
    if (continuousMini){
      let added = false;
      // เติมจนกว่าจะมี “mini ที่ยังไม่ done” อย่างน้อย 1 อัน (หรือจน pool หมด)
      while (remainingMiniPool.length > 0 && !minisAll.some(m => m && !m.done)){
        const nextDef = remainingMiniPool.shift();
        if (!nextDef) break;

        const r = computeProgress(nextDef, ctx.state, ctx);
        minisAll.push({ def: nextDef, prog: r.prog|0, target: r.target|0, done: !!r.done });
        added = true;
      }
      if (added) changed = true;
    }

    if (changed) emitUpdate(true);
  }

  function start(initialState={}){
    ctx.startedAtMs = nowMs();
    ctx.state = { ...(initialState||{}) };

    // pick initial
    const pickedGoals = pickUnique(goalDefsAll, maxGoals);
    goalsAll = pickedGoals.map(def => {
      const r = computeProgress(def, ctx.state, ctx);
      return { def, prog:r.prog|0, target:r.target|0, done:!!r.done };
    });

    // mini pool: สุ่มมาก่อน เผื่อ “ต่อภารกิจ” ได้ยาว
    remainingMiniPool = pickUnique(miniDefsAll, miniDefsAll.length);
    // ตัดเอา maxMini อันแรกเป็นชุดเริ่มต้น
    const firstMinis = remainingMiniPool.splice(0, Math.min(maxMini, remainingMiniPool.length));

    minisAll = firstMinis.map(def => {
      const r = computeProgress(def, ctx.state, ctx);
      return { def, prog:r.prog|0, target:r.target|0, done:!!r.done };
    });

    // ถ้าเริ่มมาแล้ว mini ชุดแรกดัน done (เช่น target=0) ให้เติมอันต่อไป
    refreshAllProgress();
    emitUpdate(true);
  }

  function update(nextState={}){
    // ✅ สำคัญ: ต้อง merge state ทุกครั้ง ไม่ใช่แทนทั้งก้อน
    ctx.state = { ...(ctx.state||{}), ...(nextState||{}) };
    refreshAllProgress();
  }

  function finalize(finalState={}){
    // อัปเดตสุดท้ายก่อนคำนวณผล
    update(finalState);

    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const goalsTotal = goalsAll.length;

    const miniCleared = minisAll.filter(m => m && m.done).length;
    const miniTotal = minisAll.length;

    emitUpdate(true);

    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  // public API
  return { start, update, finalize };
}
