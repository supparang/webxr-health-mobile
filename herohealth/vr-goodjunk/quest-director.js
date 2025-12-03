// === /herohealth/vr-goodjunk/quest-director.js ===
// Generic Quest Director สำหรับ Good vs Junk VR
// ใช้ร่วมกับ quest-defs-goodjunk.js และ HUD ที่ฟัง event 'quest:update'

'use strict';

// สุ่มลำดับ array แบบง่าย ๆ
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// map diff → tier key
function tierKey(diff) {
  if (diff === 'easy') return 'easy';
  if (diff === 'hard') return 'hard';
  return 'normal';
}

// แปลง definition → instance พร้อม target ตามระดับความยาก
function makeInstance(def, diff) {
  const k = tierKey(diff);
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,   // 'score' | 'goodHits' | 'missMax' | 'combo'
    target: def[k],
    prog: 0,
    done: false
  };
}

export function makeQuestDirector({
  diff     = 'normal',
  goalDefs = [],
  miniDefs = [],
  maxGoals = 2,
  maxMini  = 3
} = {}) {

  const goalOrder = shuffle(goalDefs);
  const miniOrder = shuffle(miniDefs);

  let goalsCleared = 0;
  let miniCleared  = 0;

  let goalIdx = 0;
  let miniIdx = 0;

  let currentGoal = null;
  let currentMini = null;

  let timeLeft = 60; // จะอัปเดตจาก state ภายนอก

  // ส่งข้อมูลไป HUD ผ่าน event 'quest:update'
  function emitHUD() {
    const detail = {
      goal: currentGoal ? {
        id:     currentGoal.id,
        label:  currentGoal.label,
        prog:   currentGoal.prog | 0,
        target: currentGoal.target | 0,
        done:   !!currentGoal.done
      } : null,
      mini: currentMini ? {
        id:     currentMini.id,
        label:  currentMini.label,
        prog:   currentMini.prog | 0,
        target: currentMini.target | 0,
        done:   !!currentMini.done
      } : null,
      goalsAll: currentGoal ? [currentGoal] : [],
      minisAll: currentMini ? [currentMini] : [],
      hint: ''   // ถ้าอยากส่ง hint เพิ่ม เติมภายหลังได้
    };

    try {
      window.dispatchEvent(new CustomEvent('quest:update', { detail }));
    } catch (_) {}
  }

  function nextGoal() {
    if (goalsCleared >= maxGoals || timeLeft <= 0) {
      currentGoal = null;
      emitHUD();
      return;
    }
    const base = goalOrder[goalIdx++ % goalOrder.length];
    currentGoal = makeInstance(base, diff);
    emitHUD();
  }

  function nextMini() {
    if (miniCleared >= maxMini || timeLeft <= 0) {
      currentMini = null;
      emitHUD();
      return;
    }
    const base = miniOrder[miniIdx++ % miniOrder.length];
    currentMini = makeInstance(base, diff);
    emitHUD();
  }

  // แปลง state → progress ตาม kind
  // state = { score, goodHits, miss, comboMax, timeLeft }
  function evalDef(inst, def, state) {
    if (!inst || inst.done) return;
    const kind = def.kind;

    if (kind === 'score') {
      inst.prog = state.score | 0;
    } else if (kind === 'goodHits') {
      inst.prog = state.goodHits | 0;
    } else if (kind === 'missMax') {
      // แสดงความคืบหน้าเป็นจำนวน "ใช้โควต้าไปแล้วกี่ครั้ง"
      const used = state.miss | 0;
      const usedClamped = Math.min(used, inst.target);
      inst.prog = usedClamped;
    } else if (kind === 'combo') {
      inst.prog = state.comboMax | 0;
    }
  }

  function checkFinish(inst) {
    if (!inst || inst.done) return false;

    // missMax: ถือว่า "ผ่าน" ถ้า miss ≤ target
    if (inst.kind === 'missMax') {
      if (inst.prog <= inst.target) {
        // แต่เราคิดความคืบหน้าเป็น "ใช้โควต้าไปแล้ว" อยู่
        // เงื่อนไขผ่านจริงใช้ state.miss (จะส่งมาใน update)
      }
    }

    if (inst.kind === 'missMax') {
      // inst.prog = miss ที่ใช้ไป
      const missUsed = inst.prog | 0;
      if (missUsed <= inst.target) {
        // เควสต์นี้จริง ๆ แล้วเป็นเงื่อนไขตลอดเกม
        // ถ้าจะ "ผ่าน" เราจะตัดสินตอนจบก็ได้
        // แต่เพื่อง่าย: ไม่ mark done กลางเกม
        return false;
      }
      return false;
    }

    if (inst.prog >= inst.target) {
      inst.done = true;
      return true;
    }
    return false;
  }

  function start(initialState) {
    if (initialState && typeof initialState.timeLeft === 'number') {
      timeLeft = initialState.timeLeft;
    }
    nextGoal();
    nextMini();
  }

  function update(state) {
    if (!state) state = {};
    if (typeof state.timeLeft === 'number') {
      timeLeft = state.timeLeft;
    }

    if (currentGoal) {
      const base = goalDefs.find(d => d.id === currentGoal.id);
      if (base) {
        evalDef(currentGoal, base, state);
        if (checkFinish(currentGoal)) {
          goalsCleared++;
          if (timeLeft > 0) nextGoal();
        }
      }
    }

    if (currentMini) {
      const baseM = miniDefs.find(d => d.id === currentMini.id);
      if (baseM) {
        evalDef(currentMini, baseM, state);
        if (checkFinish(currentMini)) {
          miniCleared++;
          if (timeLeft > 0) nextMini();
        }
      }
    }

    emitHUD();
  }

  function summary() {
    return {
      goalsCleared,
      goalsTotal: maxGoals,
      miniCleared,
      miniTotal: maxMini
    };
  }

  return { start, update, summary };
}

export default { makeQuestDirector };