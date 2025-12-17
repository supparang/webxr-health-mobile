// === /herohealth/vr-goodjunk/quest-director.js ===
// Generic Quest Director สำหรับ Good vs Junk VR
// ใช้ร่วมกับ quest-defs-goodjunk.js และ HUD ที่ฟัง event 'quest:update'
//
// ✅ ปรับแล้ว:
// - goalsAll/minisAll ส่ง "รายการทั้งหมดที่ถูกสุ่มขึ้นมา" (รวม done) ให้ HUD นับ cleared ได้จริง
// - mini quest ทำต่อเนื่อง: ทำเสร็จแล้วสุ่มอันใหม่จนกว่าจะครบ maxMini หรือหมดเวลา
// - missMax ไม่ mark done ระหว่างเกม (กันแสดงว่า "ครบ" ตั้งแต่ยังไม่จบ) → ตัดสินตอน finalize(state)
// - start() จะปล่อย quest:update ที่มี goal/mini จริง (ไม่ใช่ null)
// - update() จะปล่อย quest:update ต่อเนื่อง พร้อม current + รายการทั้งหมด
//
// state ที่คาดหวังจาก GameEngine: { score, goodHits, miss, comboMax, timeLeft }

'use strict';

// สุ่มลำดับ array แบบง่าย ๆ
function shuffle(arr) {
  const a = (arr || []).slice();
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
  const target = (def && typeof def[k] === 'number') ? def[k] : 0;
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,   // 'score' | 'goodHits' | 'missMax' | 'combo'
    target,
    prog: 0,
    done: false,

    // สำหรับ missMax: ตัดสินตอนท้าย (pass/fail)
    pass: null
  };
}

function asHudItem(inst) {
  if (!inst) return null;
  return {
    id: inst.id,
    label: inst.label,
    kind: inst.kind,
    target: inst.target | 0,
    prog: inst.prog | 0,
    done: !!inst.done,
    pass: (inst.pass === null ? null : !!inst.pass)
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

  let timeLeft = 60;
  let ended = false;

  // ===== HUD emitter =====
  function emitHUD(hintText = '') {
    const detail = {
      goal: asHudItem(currentGoal),
      mini: asHudItem(currentMini),

      // ✅ ส่งรายการทั้งหมด (รวม done)
      goalsAll: goalsAll.map(asHudItem),
      minisAll: minisAll.map(asHudItem),

      hint: hintText || ''
    };

    try {
      window.dispatchEvent(new CustomEvent('quest:update', { detail }));
    } catch (_) {}
  }

  function pickDef(order, idx) {
    if (!order || order.length === 0) return null;
    return order[idx % order.length] || null;
  }

  function nextGoal() {
    if (ended) return;
    if (goalsCleared >= maxGoals || timeLeft <= 0) {
      currentGoal = null;
      emitHUD();
      return;
    }

    const base = pickDef(goalOrder, goalIdx++);
    if (!base) {
      currentGoal = null;
      emitHUD();
      return;
    }

    currentGoal = makeInstance(base, diff);
    goalsAll.push(currentGoal);

    emitHUD('Goal ใหม่มาแล้ว 👀');
    coach(`Goal ใหม่: ${currentGoal.label}`);
  }

  function nextMini() {
    if (ended) return;
    if (miniCleared >= maxMini || timeLeft <= 0) {
      currentMini = null;
      emitHUD();
      return;
    }

    const base = pickDef(miniOrder, miniIdx++);
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
    const st = state || {};

    if (inst.kind === 'score') {
      inst.prog = st.score | 0;

    } else if (inst.kind === 'goodHits') {
      inst.prog = st.goodHits | 0;

    } else if (inst.kind === 'combo') {
      inst.prog = st.comboMax | 0;

    } else if (inst.kind === 'missMax') {
      // แสดงเป็น "ใช้โควต้าไปแล้วกี่ครั้ง" (ยิ่งน้อยยิ่งดี)
      const used = st.miss | 0;
      inst.prog = Math.min(used, inst.target | 0);
      // ✅ ยังไม่ตัดสิน done ที่นี่
    }
  }

  function checkFinish(inst) {
    if (!inst || inst.done) return false;

    // ✅ missMax: ไม่ให้ผ่าน/ไม่ผ่านกลางเกม (กัน HUD โชว์ครบเฉย ๆ)
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

    // reset everything (เผื่อ reuse)
    goalsAll.length = 0;
    minisAll.length = 0;
    goalsCleared = 0;
    miniCleared = 0;
    goalIdx = 0;
    miniIdx = 0;
    currentGoal = null;
    currentMini = null;

    if (initialState && typeof initialState.timeLeft === 'number') {
      timeLeft = initialState.timeLeft;
    } else {
      timeLeft = 60;
    }

    nextGoal();
    nextMini();

    // ✅ ทำให้ HUD มีค่าเริ่มต้นทันที (ไม่เป็น null -> “ครบแล้ว”)
    emitHUD('เริ่มเกมแล้ว! ทำตาม Quest ด้านขวาบน 🎯');
  }

  function update(state) {
    if (ended) return;
    const st = state || {};

    if (typeof st.timeLeft === 'number') timeLeft = st.timeLeft;

    // หมดเวลา → ไม่สุ่มภารกิจใหม่แล้ว แต่ยังส่ง HUD ได้
    if (timeLeft <= 0) {
      emitHUD('หมดเวลาแล้ว ⏱️');
      return;
    }

    // ===== Goal =====
    if (currentGoal) {
      evalInst(currentGoal, st);
      if (checkFinish(currentGoal)) {
        goalsCleared++;
        coach(`Goal ${goalsCleared}/${maxGoals} ผ่านแล้ว, Mini ${miniCleared}/${maxMini}`);
        if (timeLeft > 0) nextGoal();
      }
    }

    // ===== Mini (ต่อเนื่อง) =====
    if (currentMini) {
      evalInst(currentMini, st);
      if (checkFinish(currentMini)) {
        miniCleared++;
        coach(`Mini ${miniCleared}/${maxMini} ผ่านแล้ว, Goal ${goalsCleared}/${maxGoals}`);
        if (timeLeft > 0) nextMini();
      }
    }

    emitHUD();
  }

  // ✅ ตัดสิน missMax ตอนจบเกม
  function finalize(state) {
    if (ended) return summary();
    ended = true;

    const st = state || {};
    const miss = st.miss | 0;

    function finalizeList(list, isGoalList) {
      for (const inst of list) {
        if (!inst || inst.done) continue;
        if (inst.kind !== 'missMax') continue;

        // ผ่านถ้า miss <= target
        const pass = miss <= (inst.target | 0);
        inst.pass = pass;

        // ✅ เฉพาะ "ผ่าน" เท่านั้นที่ถือว่า done
        if (pass) {
          inst.done = true;
          if (isGoalList) goalsCleared++;
          else miniCleared++;
        } else {
          inst.done = false;
        }

        // อัปเดต prog ให้สะท้อนตอนจบ
        inst.prog = Math.min(miss, inst.target | 0);
      }
    }

    finalizeList(goalsAll, true);
    finalizeList(minisAll, false);

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
      goalsAll: goalsAll.map(asHudItem),
      minisAll: minisAll.map(asHudItem)
    };
  }

  function end(state){ return finalize(state); }

  return { start, update, finalize, end, summary };
}

export default { makeQuestDirector };
