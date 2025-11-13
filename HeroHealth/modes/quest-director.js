// === /HeroHealth/modes/quest-director.js ===
// Generic Quest Director: สุ่ม Goal 2/10 + Mini 3/15 + หมุนเควสต์ใหม่ถ้าเวลายังเหลือ

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = (Math.random()* (i+1))|0;
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function tierKey(diff){
  if(diff === 'easy') return 'easy';
  if(diff === 'hard') return 'hard';
  return 'normal';
}

// def: { id, label, kind, easy, normal, hard }
function makeInstance(def, diff){
  const k = tierKey(diff);
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,
    target: def[k],
    prog: 0,
    done: false
  };
}

export function makeQuestDirector({ diff, goalDefs, miniDefs, maxGoals=2, maxMini=3 }){
  const tier = tierKey(diff);

  const goalOrder = shuffle(goalDefs);
  const miniOrder = shuffle(miniDefs);

  let goalsCleared = 0;
  let miniCleared  = 0;

  let goalIdx = 0;
  let miniIdx = 0;

  let currentGoal = null;
  let currentMini = null;

  let timeLeft = 60; // ถูกอัปเดตจาก state

  function emitHUD(){
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: {
        goal: currentGoal ? {
          label:  currentGoal.label,
          prog:   currentGoal.prog,
          target: currentGoal.target
        } : null,
        mini: currentMini ? {
          label:  currentMini.label,
          prog:   currentMini.prog,
          target: currentMini.target
        } : null
      }
    }));
  }

  function nextGoal(){
    if (goalsCleared >= maxGoals || timeLeft <= 0){
      currentGoal = null;
      emitHUD();
      return;
    }
    const base = goalOrder[goalIdx++ % goalOrder.length];
    currentGoal = makeInstance(base, diff);
    emitHUD();
  }

  function nextMini(){
    if (miniCleared >= maxMini || timeLeft <= 0){
      currentMini = null;
      emitHUD();
      return;
    }
    const base = miniOrder[miniIdx++ % miniOrder.length];
    currentMini = makeInstance(base, diff);
    emitHUD();
  }

  // ---- helper: แปลง state → progress ตาม kind ----
  function evalDef(inst, def, state){
    const k = def.kind;
    if (!inst || inst.done) return;

    if (k === 'score'){             // คะแนนรวม
      inst.prog = state.score|0;
    }else if (k === 'goodHits'){    // เก็บของดี
      inst.prog = state.goodHits|0;
    }else if (k === 'missMax'){     // พลาดไม่เกิน X ครั้ง → นับจาก X ลงมา
      const used = state.miss|0;
      const remain = Math.max(0, inst.target - used);
      inst.prog = inst.target - remain; // แสดงเป็นใช้โควต้าไปเท่าไหร่
    }else if (k === 'combo'){       // คอมโบต่อเนื่อง
      inst.prog = state.comboMax|0;
    }else if (k === 'timeGreen'){   // เวลาในโซนดี (เช่น hydration)
      inst.prog = state.timeInGreen|0;
    }else if (k === 'plateBalanced'){
      inst.prog = state.plateScore|0;
    }
    // เพิ่ม kind อื่น ๆ ได้ตามโหมด
  }

  function checkFinish(inst, def){
    if (!inst || inst.done) return false;
    if (inst.prog >= inst.target){
      inst.done = true;
      return true;
    }
    return false;
  }

  // ---- public API ----
  function start(initialState){
    if (initialState && typeof initialState.timeLeft === 'number'){
      timeLeft = initialState.timeLeft;
    }
    nextGoal();
    nextMini();
  }

  // state = { score, goodHits, miss, comboMax, timeLeft, ... }
  function update(state){
    if (!state) state = {};
    if (typeof state.timeLeft === 'number') timeLeft = state.timeLeft;

    if (currentGoal){
      const base = goalDefs.find(d => d.id === currentGoal.id);
      if (base) evalDef(currentGoal, base, state);
      if (checkFinish(currentGoal, base)){
        goalsCleared++;
        if (timeLeft > 0) nextGoal();
      }
    }

    if (currentMini){
      const baseM = miniDefs.find(d => d.id === currentMini.id);
      if (baseM) evalDef(currentMini, baseM, state);
      if (checkFinish(currentMini, baseM)){
        miniCleared++;
        if (timeLeft > 0) nextMini();
      }
    }

    emitHUD();
  }

  function summary(){
    return {
      goalsCleared,
      goalsTotal: maxGoals,
      miniCleared,
      miniTotal: maxMini
    };
  }

  return { start, update, summary };
}
