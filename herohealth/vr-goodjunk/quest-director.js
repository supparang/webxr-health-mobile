// === /herohealth/vr-goodjunk/quest-director.js ===
// STEP 2 PATCH: Quest REAL + FEVER support
// ใช้ร่วมกับ GameEngine STEP 1
// 2025-12

'use strict';

// ---------- utils ----------
function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function coach(text){
  if (!text) return;
  window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text }}));
}

function tierKey(diff){
  if (diff === 'easy') return 'easy';
  if (diff === 'hard') return 'hard';
  return 'normal';
}

// ---------- instance ----------
function makeInstance(def, diff){
  const k = tierKey(diff);
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,          // score | goodHits | combo | missMax | fever
    target: def[k] ?? 1,
    prog: 0,
    done: false,
    pass: null               // ใช้กับ missMax
  };
}

// ---------- factory ----------
export function makeQuestDirector({
  diff     = 'normal',
  goalDefs = [],
  miniDefs = [],
  maxGoals = 2,
  maxMini  = 3
} = {}) {

  const goalOrder = shuffle(goalDefs);
  const miniOrder = shuffle(miniDefs);

  let goalIdx = 0;
  let miniIdx = 0;

  let currentGoal = null;
  let currentMini = null;

  const goalsAll = [];
  const minisAll = [];

  let goalsCleared = 0;
  let miniCleared  = 0;

  let timeLeft = 60;
  let ended = false;

  // ---------- HUD ----------
  function emitHUD(hint=''){
    window.dispatchEvent(new CustomEvent('quest:update',{
      detail:{
        goal: currentGoal,
        mini: currentMini,
        goalsAll: goalsAll.slice(),
        minisAll: minisAll.slice(),
        hint
      }
    }));
  }

  function nextGoal(){
    if (ended) return;
    if (goalsCleared >= maxGoals || timeLeft <= 0){
      currentGoal = null;
      emitHUD();
      return;
    }
    const base = goalOrder[goalIdx++ % goalOrder.length];
    currentGoal = makeInstance(base, diff);
    goalsAll.push(currentGoal);
    coach(`ภารกิจใหม่: ${currentGoal.label}`);
    emitHUD('โฟกัสภารกิจหลักด้านขวาบน');
  }

  function nextMini(){
    if (ended) return;
    if (miniCleared >= maxMini || timeLeft <= 0){
      currentMini = null;
      emitHUD();
      return;
    }
    const base = miniOrder[miniIdx++ % miniOrder.length];
    currentMini = makeInstance(base, diff);
    minisAll.push(currentMini);
    coach(`Mini quest ใหม่: ${currentMini.label}`);
    emitHUD('Mini quest ใหม่แล้ว!');
  }

  // ---------- progress ----------
  function evalInst(inst, state){
    if (!inst || inst.done) return;

    switch(inst.kind){
      case 'score':
        inst.prog = state.score | 0;
        break;
      case 'goodHits':
        inst.prog = state.goodHits | 0;
        break;
      case 'combo':
        inst.prog = state.comboMax | 0;
        break;
      case 'fever':
        inst.prog = state.feverActive ? 1 : 0;
        break;
      case 'missMax':
        inst.prog = Math.min(state.miss | 0, inst.target | 0);
        break;
    }
  }

  function checkFinish(inst){
    if (!inst || inst.done) return false;
    if (inst.kind === 'missMax') return false;

    if (inst.prog >= inst.target){
      inst.done = true;
      inst.pass = true;
      return true;
    }
    return false;
  }

  // ---------- lifecycle ----------
  function start(initialState){
    ended = false;
    timeLeft = initialState?.timeLeft ?? timeLeft;

    goalsAll.length = 0;
    minisAll.length = 0;
    goalsCleared = 0;
    miniCleared = 0;

    goalIdx = 0;
    miniIdx = 0;

    currentGoal = null;
    currentMini = null;

    nextGoal();
    nextMini();
  }

  function update(state){
    if (ended) return;
    if (!state) state = {};

    if (typeof state.timeLeft === 'number'){
      timeLeft = state.timeLeft;
      if (timeLeft <= 0) return;
    }

    // ---- goal ----
    if (currentGoal){
      evalInst(currentGoal, state);
      if (checkFinish(currentGoal)){
        goalsCleared++;
        coach(`ภารกิจหลักผ่าน ${goalsCleared}/${maxGoals}`);
        nextGoal();
      }
    }

    // ---- mini ----
    if (currentMini){
      evalInst(currentMini, state);
      if (checkFinish(currentMini)){
        miniCleared++;
        coach(`Mini quest ผ่าน ${miniCleared}/${maxMini}`);
        nextMini();
      }
    }

    emitHUD();
  }

  // ---------- finalize (missMax) ----------
  function finalize(state){
    if (ended) return summary();
    ended = true;

    const miss = state?.miss | 0;

    function finalizeList(list, isGoal){
      for (const inst of list){
        if (inst.done || inst.kind !== 'missMax') continue;
        const pass = miss <= inst.target;
        inst.pass = pass;
        inst.done = pass;
        if (pass){
          if (isGoal) goalsCleared++;
          else miniCleared++;
        }
      }
    }

    finalizeList(goalsAll,true);
    finalizeList(minisAll,false);

    currentGoal = null;
    currentMini = null;

    emitHUD('สรุปภารกิจพร้อมแล้ว');
    return summary();
  }

  function summary(){
    return {
      goalsCleared,
      goalsTotal: maxGoals,
      miniCleared,
      miniTotal: maxMini,
      goalsAll: goalsAll.slice(),
      minisAll: minisAll.slice()
    };
  }

  return { start, update, finalize, summary };
}

export default { makeQuestDirector };
