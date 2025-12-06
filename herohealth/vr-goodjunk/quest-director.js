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

  // แยก early / late ตาม lateOnly (เช่น missMax ให้ออกหลัง ๆ)
  const goalEarly = goalDefs.filter(d => !d.lateOnly);
  const goalLate  = goalDefs.filter(d =>  d.lateOnly);
  const miniEarly = miniDefs.filter(d => !d.lateOnly);
  const miniLate  = miniDefs.filter(d =>  d.lateOnly);

  const goalOrder = [...shuffle(goalEarly), ...shuffle(goalLate)];
  const miniOrder = [...shuffle(miniEarly), ...shuffle(miniLate)];

  let goalsCleared = 0;
  let miniCleared  = 0;

  let goalIdx = 0;
  let miniIdx = 0;

  let currentGoal = null;
  let currentMini = null;

  let timeLeft     = 60; // จะอัปเดตจาก state ภายนอก
  let totalTimeRef = 60; // เก็บเวลาตั้งต้นไว้ใช้คำนวณอัตราส่วนเวลา

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
      hint: ''
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
      const raw = state.score | 0;
      inst.prog = Math.min(raw, inst.target);   // ✅ ไม่ให้เกิน target
    } else if (kind === 'goodHits') {
      const raw = state.goodHits | 0;
      inst.prog = Math.min(raw, inst.target);
    } else if (kind === 'combo') {
      const raw = state.comboMax | 0;
      inst.prog = Math.min(raw, inst.target);
    } else if (kind === 'missMax') {
      // แสดง "ใช้โควต้าไปแล้วกี่ครั้ง" แต่ clamp ไม่เกิน target
      const used = state.miss | 0;
      inst.prog = Math.min(used, inst.target);
    }
  }

  function checkFinish(inst, def, state) {
    if (!inst || inst.done) return false;

    if (inst.kind === 'missMax') {
      // ✅ เควสต์ "พลาดไม่เกิน X" ให้ตัดสินตอนหมดเวลาเท่านั้น
      const missUsed = (state.miss | 0);
      const tLeft    = typeof state.timeLeft === 'number' ? state.timeLeft : timeLeft;
      if (tLeft <= 0 && missUsed <= inst.target) {
        inst.done = true;
        return true;
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
      timeLeft     = initialState.timeLeft;
      totalTimeRef = initialState.timeLeft;
    }
    nextGoal();
    nextMini();
  }

  function update(state) {
    if (!state) state = {};
    if (typeof state.timeLeft === 'number') {
      timeLeft = state.timeLeft;
      if (!totalTimeRef && timeLeft > 0) {
        totalTimeRef = timeLeft;
      }
    }

    if (currentGoal) {
      const base = goalDefs.find(d => d.id === currentGoal.id);
      if (base) {
        evalDef(currentGoal, base, state);
        if (checkFinish(currentGoal, base, state)) {
          goalsCleared++;
          if (timeLeft > 0) nextGoal();
        }
      }
    }

    if (currentMini) {
      const baseM = miniDefs.find(d => d.id === currentMini.id);
      if (baseM) {
        evalDef(currentMini, baseM, state);
        if (checkFinish(currentMini, baseM, state)) {
          miniCleared++;
          if (timeLeft > 0) nextMini();
        }
      }
    }

    emitHUD();
  }

  function summary(state = {}) {
    // สรุปผลรวม + handle missMax กรณียังไม่ถูก mark done แต่ผ่านเงื่อนไขตอนจบ
    const s = {
      goalsCleared,
      goalsTotal: maxGoals,
      miniCleared,
      miniTotal: maxMini
    };

    return s;
  }

  return { start, update, summary };
}

export default { makeQuestDirector };
