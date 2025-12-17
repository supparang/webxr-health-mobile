// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals + Mini quests) for GoodJunkVR
// - 2 Goals per game
// - 3 Mini quests per game (sequential: finish one -> next until quota filled)
// - Start: choose quests and emit HUD only (no auto-complete)
// - Update: update progress from state (score/goodHits/miss/comboMax/timeLeft)
// - Finalize: evaluate end-of-game conditions (miss/timeLeft based)

'use strict';

function clamp01(x){
  x = Number(x) || 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function toInt(x){
  return (Number(x) || 0) | 0;
}

function safeArr(a){
  return Array.isArray(a) ? a : [];
}

function pickRandom(arr, usedSet){
  const pool = safeArr(arr).filter(it => it && it.id && !(usedSet && usedSet.has(it.id)));
  if (!pool.length) return null;
  return pool[(Math.random() * pool.length) | 0];
}

function nowMs(){
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function emitQuestUpdate(payload){
  window.dispatchEvent(new CustomEvent('quest:update', { detail: payload }));
}

function computeHint(goal, mini){
  const g = goal && goal.hint ? goal.hint : '';
  const m = mini && mini.hint ? mini.hint : '';
  if (g && m) return g + ' • ' + m;
  return g || m || '';
}

/**
 * Quest definition contract (suggested):
 * {
 *   id: 'g_goodHits',
 *   label: 'เก็บของดีให้ครบ 12 ชิ้น',
 *   hint: 'โฟกัสผัก ผลไม้ นม',
 *   // target getter:
 *   target(diff, runMode) => number,
 *   // progress getter from state:
 *   getProgress(state) => number,
 *   // optional finalize hook:
 *   finalize?(state) => number
 * }
 */

function buildInstance(def, diff, runMode){
  const target = def && typeof def.target === 'function'
    ? toInt(def.target(diff, runMode))
    : toInt(def && def.target);

  return {
    id: def && def.id ? String(def.id) : ('q_' + Math.random().toString(16).slice(2)),
    label: def && def.label ? String(def.label) : 'ภารกิจ',
    hint: def && def.hint ? String(def.hint) : '',
    target: Math.max(1, target || 1),
    prog: 0,
    done: false,
    _def: def || null
  };
}

function updateInstance(inst, state, forceFinalize){
  if (!inst || !inst._def) return inst;
  const def = inst._def;
  const getter = (forceFinalize && typeof def.finalize === 'function')
    ? def.finalize
    : def.getProgress;

  const pRaw = (typeof getter === 'function') ? getter(state) : 0;
  const prog = Math.max(0, Math.min(inst.target, toInt(pRaw)));

  inst.prog = prog;
  inst.done = (inst.prog >= inst.target);
  return inst;
}

function makeDirector(opts){
  const diff = String(opts && opts.diff ? opts.diff : 'normal').toLowerCase();
  const goalDefs = safeArr(opts && opts.goalDefs);
  const miniDefs = safeArr(opts && opts.miniDefs);
  const maxGoals = Math.max(1, toInt(opts && opts.maxGoals) || 2);
  const maxMini  = Math.max(1, toInt(opts && opts.maxMini)  || 3);

  const usedGoals = new Set();
  const usedMinis = new Set();

  const goalsAll = [];
  const minisAll = [];

  let activeGoal = null;
  let activeMini = null;

  let goalsCleared = 0;
  let miniCleared  = 0;

  let started = false;
  let lastEmitAt = 0;

  function emitHUD(){
    // ส่งเฉพาะ active/current + รายการทั้งหมด
    emitQuestUpdate({
      goal: activeGoal,
      mini: activeMini,
      goalsAll: goalsAll,
      minisAll: minisAll,
      hint: computeHint(activeGoal, activeMini),
      goalsCleared,
      goalsTotal: goalsAll.length,
      miniCleared,
      miniTotal: minisAll.length
    });
  }

  function ensurePool(){
    // เติม goalsAll ให้ครบ maxGoals
    while (goalsAll.length < maxGoals){
      const picked = pickRandom(goalDefs, usedGoals);
      if (!picked) break;
      usedGoals.add(picked.id);
      goalsAll.push(buildInstance(picked, diff, opts.runMode || 'play'));
    }
    // เติม minisAll ให้ครบ maxMini
    while (minisAll.length < maxMini){
      const picked = pickRandom(miniDefs, usedMinis);
      if (!picked) break;
      usedMinis.add(picked.id);
      minisAll.push(buildInstance(picked, diff, opts.runMode || 'play'));
    }
  }

  function setActiveGoalFirstNotDone(){
    activeGoal = null;
    for (const g of goalsAll){
      if (g && !g.done){ activeGoal = g; break; }
    }
  }

  function setActiveMiniFirstNotDone(){
    activeMini = null;
    for (const m of minisAll){
      if (m && !m.done){ activeMini = m; break; }
    }
  }

  function refreshClearedCounts(){
    goalsCleared = goalsAll.filter(q => q && q.done).length;
    miniCleared  = minisAll.filter(q => q && q.done).length;
  }

  function start(state){
    // start = สุ่มเควสต์ + reset prog เป็น 0 + emit HUD (ไม่ auto-complete)
    started = true;

    // runMode มีผลต่อ target บางอัน (เช่น adaptive off ใน research)
    opts.runMode = (opts && opts.runMode) ? String(opts.runMode).toLowerCase() : (opts.runMode || 'play');

    ensurePool();

    // รีเซ็ต progress ให้ชัดตอนเริ่ม
    for (const g of goalsAll){ if (g){ g.prog = 0; g.done = false; } }
    for (const m of minisAll){ if (m){ m.prog = 0; m.done = false; } }

    setActiveGoalFirstNotDone();
    setActiveMiniFirstNotDone();
    refreshClearedCounts();
    emitHUD();
    return api;
  }

  function update(state){
    if (!started) return api;
    state = state || {};

    // throttle emit เล็กน้อย กัน event ถี่มาก
    const t = nowMs();
    const allowEmit = (t - lastEmitAt) > 60;

    // update progress
    if (activeGoal) updateInstance(activeGoal, state, false);
    if (activeMini) updateInstance(activeMini, state, false);

    // ถ้าเควสต์ปัจจุบัน done แล้ว -> เลือกตัวถัดไป (sequential)
    const goalJustDone = (activeGoal && activeGoal.done);
    const miniJustDone = (activeMini && activeMini.done);

    if (goalJustDone){
      setActiveGoalFirstNotDone();
    }
    if (miniJustDone){
      setActiveMiniFirstNotDone();
    }

    refreshClearedCounts();

    if (allowEmit || goalJustDone || miniJustDone){
      lastEmitAt = t;
      emitHUD();
    }
    return api;
  }

  function finalize(state){
    // finalize = อัปเดต progress รอบสุดท้าย โดย allow def.finalize
    state = state || {};

    for (const g of goalsAll){
      if (g) updateInstance(g, state, true);
    }
    for (const m of minisAll){
      if (m) updateInstance(m, state, true);
    }

    setActiveGoalFirstNotDone();
    setActiveMiniFirstNotDone();
    refreshClearedCounts();
    emitHUD();

    return {
      goalsCleared,
      goalsTotal: goalsAll.length,
      miniCleared,
      miniTotal: minisAll.length,
      goalsAll,
      minisAll
    };
  }

  const api = {
    start,
    update,
    finalize,
    getSnapshot(){
      return {
        goal: activeGoal,
        mini: activeMini,
        goalsAll,
        minisAll,
        goalsCleared,
        goalsTotal: goalsAll.length,
        miniCleared,
        miniTotal: minisAll.length
      };
    }
  };

  return api;
}

export function makeQuestDirector(opts = {}){
  return makeDirector(opts);
}

export default { makeQuestDirector };
