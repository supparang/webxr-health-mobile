// === /herohealth/vr-goodjunk/quest-director.js ===
// Generic Quest Director สำหรับ Good vs Junk VR
// ใช้ร่วมกับ quest-defs-goodjunk.js และ HUD ที่ฟัง event 'quest:update'
//
// ปรับแล้ว:
// - goalsAll/minisAll ส่ง "รายการทั้งหมด" (รวม done) เพื่อให้ HUD นับ cleared ได้จริง
// - mini quest ทำต่อเนื่อง (ทำเสร็จแล้วสุ่มอันใหม่) จนครบ maxMini หรือหมดเวลา
// - missMax ตัดสินตอนจบด้วย finalize(state)
// - summary() ใช้ค่าจริงสำหรับ hha:end
//
// state ที่คาดหวัง: { score, goodHits, miss, comboMax, timeLeft }

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

// ส่งข้อความไป bubble โค้ช
function coach(text) {
  if (!text) return;
  try {
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: { text: String(text) }
    }));
  } catch (_) {}
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
    done: false,
    // สำหรับ missMax: ตัดสินตอนท้าย (pass/fail)
    pass: null
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

  // เก็บ "ทั้งหมดที่เกิดขึ้นแล้ว" เพื่อส่งไป HUD ให้คำนวณ cleared ถูก
  const goalsAll = [];
  const minisAll = [];

  let timeLeft = 60; // จะอัปเดตจาก state ภายนอก
  let ended = false;

  // ส่งข้อมูลไป HUD ผ่าน event 'quest:update'
  function emitHUD(hintText = '') {
    const detail = {
      goal: currentGoal ? {
        id:     currentGoal.id,
        label:  currentGoal.label,
        prog:   currentGoal.prog | 0,
        target: currentGoal.target | 0,
        done:   !!currentGoal.done,
        kind:   currentGoal.kind
      } : null,
      mini: currentMini ? {
        id:     currentMini.id,
        label:  currentMini.label,
        prog:   currentMini.prog | 0,
        target: currentMini.target | 0,
        done:   !!currentMini.done,
        kind:   currentMini.kind
      } : null,

      // ✅ ส่ง "รายการทั้งหมด" ไม่ใช่แค่ current
      goalsAll: goalsAll.slice(),
      minisAll: minisAll.slice(),

      hint: hintText || ''
    };

    try {
      window.dispatchEvent(new CustomEvent('quest:update', { detail }));
    } catch (_) {}
  }

  function pickDef(defs, order, idx) {
    if (!order || order.length === 0) return null;
    const base = order[idx % order.length];
    return base || null;
  }

  function nextGoal() {
    if (ended) return;
    if (goalsCleared >= maxGoals || timeLeft <= 0) {
      currentGoal = null;
      emitHUD();
      return;
    }

    const base = pickDef(goalDefs, goalOrder, goalIdx++);
    if (!base) {
      currentGoal = null;
      emitHUD();
      return;
    }

    currentGoal = makeInstance(base, diff);
    goalsAll.push(currentGoal);

    emitHUD('โฟกัส Goal ใหม่ด้านขวาบน 👀');
    coach(`Goal ใหม่: ${currentGoal.label}`);
  }

  function nextMini() {
    if (ended) return;
    if (miniCleared >= maxMini || timeLeft <= 0) {
      currentMini = null;
      emitHUD();
      return;
    }

    const base = pickDef(miniDefs, miniOrder, miniIdx++);
    if (!base) {
      currentMini = null;
      emitHUD();
      return;
    }

    currentMini = makeInstance(base, diff);
    minisAll.push(currentMini);

    emitHUD('Mini quest เปลี่ยนแล้ว ลุยต่อเลย! ⚡');
    coach(`Mini quest ใหม่: ${currentMini.label}`);
  }

  // แปลง state → progress ตาม kind
  function evalInst(inst, state) {
    if (!inst || inst.done) return;

    const kind = inst.kind;

    if (kind === 'score') {
      inst.prog = state.score | 0;

    } else if (kind === 'goodHits') {
      inst.prog = state.goodHits | 0;

    } else if (kind === 'combo') {
      inst.prog = state.comboMax | 0;

    } else if (kind === 'missMax') {
      // แสดงเป็น "ใช้โควต้าไปแล้ว" (ยิ่งน้อยยิ่งดี)
      const used = state.miss | 0;
      inst.prog = Math.min(used, inst.target | 0);
      // ✅ ยังไม่ตัดสิน done ที่นี่ (ค่อยตัดสินตอน finalize)
    }
  }

  function checkFinish(inst) {
    if (!inst || inst.done) return false;

    // missMax: ตัดสินตอนท้ายเกมเท่านั้น
    if (inst.kind === 'missMax') return false;

    if ((inst.prog | 0) >= (inst.target | 0)) {
      inst.done = true;
      inst.pass = true;
      return true;
    }
    return false;
  }

  function start(initialState) {
    ended = false;
    if (initialState && typeof initialState.timeLeft === 'number') {
      timeLeft = initialState.timeLeft;
    }

    // เคลียร์ (เผื่อ reuse)
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

  function update(state) {
    if (ended) return;
    if (!state) state = {};

    if (typeof state.timeLeft === 'number') timeLeft = state.timeLeft;

    // ถ้าหมดเวลา ให้หยุดหมุนภารกิจใหม่
    if (timeLeft <= 0) {
      emitHUD('หมดเวลาแล้ว ⏱️');
      return;
    }

    // ===== Goal =====
    if (currentGoal) {
      evalInst(currentGoal, state);
      if (checkFinish(currentGoal)) {
        goalsCleared++;
        coach(`Goal ${goalsCleared}/${maxGoals} ผ่านแล้ว, Mini ${miniCleared}/${maxMini}`);
        if (timeLeft > 0) nextGoal();
      }
    }

    // ===== Mini =====
    if (currentMini) {
      evalInst(currentMini, state);
      if (checkFinish(currentMini)) {
        miniCleared++;
        coach(`Mini ${miniCleared}/${maxMini} ผ่านแล้ว, Goal ${goalsCleared}/${maxGoals}`);
        if (timeLeft > 0) nextMini(); // ✅ ต่อเนื่องเรื่อย ๆ
      }
    }

    // ส่ง HUD ต่อเนื่อง
    emitHUD();
  }

  // ✅ ตัดสิน missMax ตอนจบเกม
  // เรียกตอน GameEngine.stop(...) ก่อนยิง hha:end หรือก่อน summary()
  function finalize(state) {
    if (ended) return summary();
    ended = true;

    if (!state) state = {};
    const miss = state.miss | 0;

    // ตัดสินทุกภารกิจชนิด missMax ที่เคยสุ่มขึ้นมา
    function finalizeList(list, isGoalList) {
      for (const inst of list) {
        if (!inst || inst.done) continue;
        if (inst.kind !== 'missMax') continue;

        // ผ่านถ้า miss <= target
        const pass = miss <= (inst.target | 0);
        inst.pass = pass;
        inst.done = pass; // ✅ mark done ถ้าผ่าน (ถ้าไม่ผ่านจะคง false)

        if (pass) {
          if (isGoalList) goalsCleared++;
          else miniCleared++;
        }
      }
    }

    finalizeList(goalsAll, true);
    finalizeList(minisAll, false);

    // เคลียร์ current ให้ HUD โชว์ว่า "ครบ/จบ" ได้สวย
    if (goalsCleared >= maxGoals) currentGoal = null;
    if (miniCleared >= maxMini) currentMini = null;

    emitHUD('สรุปภารกิจพร้อมแล้ว ✅');
    return summary();
  }

  function summary() {
    return {
      goalsCleared,
      goalsTotal: maxGoals,
      miniCleared,
      miniTotal: maxMini,
      goalsAll: goalsAll.slice(),
      minisAll: minisAll.slice()
    };
  }

  // alias เผื่อชอบชื่อ end()
  function end(state){ return finalize(state); }

  return { start, update, finalize, end, summary };
}

export default { makeQuestDirector };
