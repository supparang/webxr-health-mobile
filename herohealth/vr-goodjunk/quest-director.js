// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals + Mini quests)
// Emits: window.dispatchEvent(new CustomEvent('quest:update',{detail:{...}}))

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

function pickUnique(list, n){
  const src = Array.isArray(list) ? list.slice() : [];
  // shuffle
  for (let i = src.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [src[i], src[j]] = [src[j], src[i]];
  }
  return src.slice(0, Math.max(0, Math.min(n, src.length)));
}

function getTarget(def, ctx){
  if (!def) return 1;
  if (typeof def.target === 'function') return (def.target(ctx) | 0) || 1;
  const t = (def.target | 0);
  return t > 0 ? t : 1;
}

function getProgress(def, state, ctx){
  if (!def) return 0;
  if (typeof def.progress === 'function') return (def.progress(state, ctx) | 0) || 0;
  if (typeof def.getProgress === 'function') return (def.getProgress(state, ctx) | 0) || 0;
  return 0;
}

function isDone(def, state, prog, target, ctx){
  if (!def) return true;
  if (typeof def.done === 'function') return !!def.done(state, prog, target, ctx);
  return prog >= target;
}

function emitUpdate(payload){
  ROOT.dispatchEvent(new CustomEvent('quest:update', { detail: payload }));
}

export function makeQuestDirector(opts = {}){
  const diff = String(opts.diff || 'normal').toLowerCase();

  const goalDefsAll = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefsAll = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];

  const maxGoals = Math.max(1, (opts.maxGoals | 0) || 2);
  const maxMini  = Math.max(1, (opts.maxMini  | 0) || 3);

  const ctx = { diff };

  let goals = [];
  let minis = [];

  let started = false;

  function buildDeck(){
    goals = pickUnique(goalDefsAll, maxGoals).map(d => ({
      ...d,
      done:false,
      prog:0,
      target: getTarget(d, ctx)
    }));

    minis = pickUnique(miniDefsAll, maxMini).map(d => ({
      ...d,
      done:false,
      prog:0,
      target: getTarget(d, ctx)
    }));
  }

  function currentGoal(){
    return goals.find(g => !g.done) || null;
  }

  function currentMini(){
    return minis.find(m => !m.done) || null;
  }

  function updateAll(state){
    // goals
    for (const g of goals){
      if (g.done) continue;
      g.prog = getProgress(g, state, ctx);
      g.target = getTarget(g, ctx);
      if (isDone(g, state, g.prog, g.target, ctx)){
        g.done = true;
      }
    }

    // minis (ทำแบบ sequential: จบตัวแรกก่อนค่อยไปตัวถัดไป)
    const cur = currentMini();
    if (cur){
      cur.prog = getProgress(cur, state, ctx);
      cur.target = getTarget(cur, ctx);
      if (isDone(cur, state, cur.prog, cur.target, ctx)){
        cur.done = true;
      }
    }
  }

  function publish(state, hintText=''){
    const g = currentGoal();
    const m = currentMini();

    emitUpdate({
      goal: g ? { id:g.id, label:g.label, prog:g.prog|0, target:g.target|0, done:!!g.done } : null,
      mini: m ? { id:m.id, label:m.label, prog:m.prog|0, target:m.target|0, done:!!m.done } : null,
      hint: hintText || (g && g.hint) || '',
      goalsAll: goals.map(x => ({ id:x.id, label:x.label, prog:x.prog|0, target:x.target|0, done:!!x.done })),
      minisAll: minis.map(x => ({ id:x.id, label:x.label, prog:x.prog|0, target:x.target|0, done:!!x.done }))
    });
  }

  function start(state){
    started = true;
    buildDeck();
    updateAll(state || {});
    publish(state || {}, 'ทำภารกิจหลัก + mini quest ให้ครบเพื่อเก็บเกรดสูงสุด! ✨');
  }

  function update(state){
    if (!started) return;
    updateAll(state || {});
    const g = currentGoal();
    const hint = g && g.hint ? g.hint : '';
    publish(state || {}, hint);
  }

  function finalize(state){
    if (!started) {
      return { goalsCleared:0, goalsTotal:0, miniCleared:0, miniTotal:0 };
    }
    // force update everything at end (รวม mini ทั้งหมดให้ประเมินด้วย)
    for (const g of goals){
      if (!g.done){
        g.prog = getProgress(g, state || {}, ctx);
        g.target = getTarget(g, ctx);
        g.done = isDone(g, state || {}, g.prog, g.target, ctx);
      }
    }
    for (const m of minis){
      if (!m.done){
        m.prog = getProgress(m, state || {}, ctx);
        m.target = getTarget(m, ctx);
        m.done = isDone(m, state || {}, m.prog, m.target, ctx);
      }
    }

    publish(state || {}, 'สรุปผลภารกิจเรียบร้อย ✅');

    const goalsCleared = goals.filter(x => x.done).length;
    const miniCleared  = minis.filter(x => x.done).length;

    return {
      goalsCleared,
      goalsTotal: goals.length,
      miniCleared,
      miniTotal: minis.length
    };
  }

  return { start, update, finalize };
}
