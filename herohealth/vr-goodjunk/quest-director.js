// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals + Mini Quests) — HeroHealth
// ✅ FIX: ROOT defined
// ✅ NEW: supports def.deferStart = true (ไม่ evaluate done ตอน start)
// Mini quest = ต่อเนื่องทีละอัน (ทำจบแล้วเลื่อนไปอันถัดไป)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function safeArr(x){ return Array.isArray(x) ? x : (x ? [x] : []); }

function pickUnique(list, count){
  const arr = safeArr(list).slice();
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr.slice(0, Math.max(0, Math.min(count, arr.length)));
}

function normalizeDef(def, fallbackId){
  const d = def || {};
  return {
    id: d.id || d.key || d.metric || fallbackId || ('q_' + Math.random().toString(16).slice(2)),
    label: d.label || d.title || d.name || 'ภารกิจ',
    hint: d.hint || d.desc || d.description || '',
    target: d.target,
    getProgress:
      (typeof d.getProgress === 'function') ? d.getProgress :
      (typeof d.progress === 'function') ? d.progress :
      null,
    metric: (typeof d.metric === 'string' && d.metric) ? d.metric : null,
    key: (typeof d.key === 'string' && d.key) ? d.key : null,
    isDone:
      (typeof d.isDone === 'function') ? d.isDone :
      (typeof d.done === 'function') ? d.done :
      null,
    deferStart: !!d.deferStart
  };
}

function resolveTarget(def, ctx){
  try{
    if (typeof def.target === 'function'){
      const v = def.target(ctx || {});
      return Math.max(1, Number(v) || 1);
    }
    if (typeof def.target === 'number') return Math.max(1, def.target || 1);
  }catch(_){}
  return 1;
}

function resolveProgress(def, state, ctx){
  try{
    if (def.getProgress) return Number(def.getProgress(state, ctx)) || 0;
    const k = def.metric || def.key;
    if (k && state && Object.prototype.hasOwnProperty.call(state, k)){
      return Number(state[k]) || 0;
    }
  }catch(_){}
  return 0;
}

function resolveDone(def, state, prog, target, ctx){
  try{
    if (def.isDone) return !!def.isDone(state, prog, target, ctx);
  }catch(_){}
  return (Number(prog) || 0) >= (Number(target) || 1);
}

function makeItem(def, index, ctx){
  const d = normalizeDef(def, 'def_' + index);
  const target = resolveTarget(d, ctx);
  return {
    id: d.id,
    label: d.label,
    hint: d.hint,
    target,
    _def: d,
    prog: 0,
    done: false
  };
}

function emitUpdate(payload){
  try{
    ROOT.dispatchEvent(new CustomEvent('quest:update', { detail: payload }));
  }catch(err){
    console.warn('[QuestDirector] emitUpdate failed:', err);
  }
}

export function makeQuestDirector(opts = {}){
  const diff = String(opts.diff || 'normal').toLowerCase();
  const ctx = { diff };

  const maxGoals = Number(opts.maxGoals ?? 2) || 2;
  const maxMini  = Number(opts.maxMini  ?? 3) || 3;

  const goalDefs = safeArr(opts.goalDefs);
  const miniDefs = safeArr(opts.miniDefs);

  const pickedGoals = pickUnique(goalDefs, maxGoals).map((d,i)=>makeItem(d,i,ctx));
  const pickedMinis = pickUnique(miniDefs, maxMini).map((d,i)=>makeItem(d,i,ctx));

  let started = false;
  let goalIdx = 0;
  let miniIdx = 0;

  function currentGoal(){ return pickedGoals[goalIdx] || null; }
  function currentMini(){ return pickedMinis[miniIdx] || null; }

  function updateOne(item, state, phase){
    if (!item || item.done) return item;

    const progRaw = resolveProgress(item._def, state, ctx);
    item.prog = Math.max(0, Math.floor(Number(progRaw) || 0));

    // ✅ กัน “ผ่านเลยตอนเริ่ม” สำหรับ constraint/เงื่อนไข
    if (phase === 'start' && item._def.deferStart){
      item.done = false;
      return item;
    }

    item.done = resolveDone(item._def, state, item.prog, item.target, ctx);
    return item;
  }

  function advanceIfDone(){
    while (goalIdx < pickedGoals.length && pickedGoals[goalIdx]?.done) goalIdx++;
    while (miniIdx < pickedMinis.length && pickedMinis[miniIdx]?.done) miniIdx++;
  }

  function buildPayload(){
    const g = currentGoal();
    const m = currentMini();

    const goalsCleared = pickedGoals.filter(x => x.done).length;
    const miniCleared  = pickedMinis.filter(x => x.done).length;

    const goalPayload = g ? {
      id: g.id, label: g.label, hint: g.hint,
      prog: g.prog|0, target: g.target|0, done: !!g.done
    } : null;

    const miniPayload = m ? {
      id: m.id, label: m.label, hint: m.hint,
      prog: m.prog|0, target: m.target|0, done: !!m.done
    } : null;

    return {
      diff,
      goal: goalPayload,
      mini: miniPayload,
      goalsAll: pickedGoals.map(x => ({ id:x.id, label:x.label, prog:x.prog|0, target:x.target|0, done:!!x.done })),
      minisAll: pickedMinis.map(x => ({ id:x.id, label:x.label, prog:x.prog|0, target:x.target|0, done:!!x.done })),
      goalsCleared,
      goalsTotal: pickedGoals.length,
      miniCleared,
      miniTotal: pickedMinis.length,
      hint: (goalPayload && goalPayload.hint) ? goalPayload.hint
          : (miniPayload && miniPayload.hint) ? miniPayload.hint
          : ''
    };
  }

  function start(initialState = {}){
    started = true;

    // Goals: init แต่ไม่ให้ constraint ผ่านทันที
    for (const g of pickedGoals) updateOne(g, initialState, 'start');
    if (pickedMinis[0]) updateOne(pickedMinis[0], initialState, 'start');

    advanceIfDone();
    emitUpdate(buildPayload());
  }

  function update(state = {}){
    if (!started) return;

    const g = currentGoal();
    if (g) updateOne(g, state, 'update');

    const m = currentMini();
    if (m) updateOne(m, state, 'update');

    const beforeG = goalIdx;
    const beforeM = miniIdx;

    advanceIfDone();

    if (goalIdx !== beforeG){
      const g2 = currentGoal();
      if (g2) updateOne(g2, state, 'update');
    }
    if (miniIdx !== beforeM){
      const m2 = currentMini();
      if (m2) updateOne(m2, state, 'update');
    }

    emitUpdate(buildPayload());
  }

  function finalize(finalState = {}){
    for (const g of pickedGoals) updateOne(g, finalState, 'final');
    for (const m of pickedMinis) updateOne(m, finalState, 'final');
    advanceIfDone();
    const p = buildPayload();
    return {
      goalsCleared: p.goalsCleared|0,
      goalsTotal: p.goalsTotal|0,
      miniCleared: p.miniCleared|0,
      miniTotal: p.miniTotal|0
    };
  }

  return { start, update, finalize };
}

export default { makeQuestDirector };