// === /herohealth/vr-goodjunk/quest-director.js ===
// Generic Quest Director สำหรับ Good vs Junk VR
// ใช้ร่วมกับ quest-defs-goodjunk.js และ HUD ที่ฟัง event 'quest:update'
//
// กติกา:
// - mini quest ทำต่อเนื่อง (ทำเสร็จแล้วสุ่มอันใหม่) จนครบ maxMini หรือหมดเวลา
// - missMax ตัดสินตอนจบด้วย finalize(state) เท่านั้น (ผ่านถ้า miss <= target)
// - goalsAll/minisAll ส่ง "รายการทั้งหมด" (รวม done/pass) เพื่อให้ HUD นับ cleared ถูก
//
// state ที่คาดหวัง: { score, goodHits, miss, comboMax, timeLeft }

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
  diff = String(diff || 'normal').toLowerCase();
  if (diff === 'easy') return 'easy';
  if (diff === 'hard') return 'hard';
  return 'normal';
}

// แปลง definition → instance พร้อม target ตามระดับความยาก
function makeInstance(def, diff) {
  const k = tierKey(diff);
  const tgt = def && typeof def[k] === 'number' ? def[k] : 0;
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,      // 'score' | 'goodHits' | 'missMax' | 'combo'
    target: tgt | 0,
    prog: 0,
    done: false,
    pass: null           // สำหรับ missMax: ตัดสินตอนท้าย
  };
}

export function makeQuestDirector({
  diff     = 'normal',
  goalDefs = [],
  miniDefs = [],
  maxGoals = 2,
  maxMini  = 3
} = {}) {

  // random orders
  const goalOrder = shuffle(goalDefs);
  const miniOrder = shuffle(miniDefs);

  // pointers
  let goalIdx = 0;
  let miniIdx = 0;

  // cleared counters
  let goalsCleared = 0;
  let miniCleared  = 0;

  // current quests
  let currentGoal = null;
  let currentMini = null;

  // all instances that have appeared (for HUD counting)
  const goalsAll = [];
  const minisAll = [];

  let timeLeft = 60;
  let ended = false;

  function emitHUD(hintText = '') {
    const detail = {
      goal: currentGoal ? {
        id: currentGoal.id,
        label: currentGoal.label,
        kind: currentGoal.kind,
        prog: currentGoal.prog | 0,
        target: currentGoal.target | 0,
        done: !!currentGoal.done,
        pass: currentGoal.pass
      } : null,

      mini: currentMini ? {
        id: currentMini.id,
        label: currentMini.label,
        kind: currentMini.kind,
        prog: currentMini.prog | 0,
        target: currentMini.target | 0,
        done: !!currentMini.done,
        pass: currentMini.pass
      } : null,

      goalsAll: goalsAll.slice(),
      minisAll: minisAll.slice(),
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
    // ✅ เริ่มต้น prog = 0 เสมอ กัน “ผ่านเอง”
    currentGoal.prog = 0;
    currentGoal.done = false;
    currentGoal.pass = null;

    goalsAll.push(currentGoal);
    emitHUD('Goal ใหม่! มองที่แผง Quest ด้านขวาบน 👀');
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
    currentMini.prog = 0;
    currentMini.done = false;
    currentMini.pass = null;

    minisAll.push(currentMini);
    emitHUD('Mini quest เปลี่ยนแล้ว ลุยต่อเลย! ⚡');
    coach(`Mini quest ใหม่: ${currentMini.label}`);
  }

  function evalInst(inst, state) {
    if (!inst || inst.done) return;
    if (!state) state = {};

    const kind = inst.kind;

    if (kind === 'score') {
      inst.prog = (state.score | 0);

    } else if (kind === 'goodHits') {
      inst.prog = (state.goodHits | 0);

    } else if (kind === 'combo') {
      inst.prog = (state.comboMax | 0);

    } else if (kind === 'missMax') {
      // แสดงเป็น "ใช้โควต้าไปแล้ว" (ยิ่งน้อยยิ่งดี)
      const used = (state.miss | 0);
      inst.prog = Math.min(used, inst.target | 0);
      // ✅ ยังไม่ตัดสิน done ที่นี่
    }
  }

  function checkFinish(inst) {
    if (!inst || inst.done) return false;
    if (inst.kind === 'missMax') return false; // finalize เท่านั้น

    if ((inst.prog | 0) >= (inst.target | 0)) {
      inst.done = true;
      inst.pass = true;
      return true;
    }
    return false;
  }

  function resetAll() {
    goalsAll.length = 0;
    minisAll.length = 0;

    goalIdx = 0;
    miniIdx = 0;

    goalsCleared = 0;
    miniCleared = 0;

    currentGoal = null;
    currentMini = null;

    ended = false;
  }

  function start(initialState) {
    resetAll();

    if (initialState && typeof initialState.timeLeft === 'number') {
      timeLeft = initialState.timeLeft;
    }

    // ✅ สุ่มภารกิจ แต่ยังไม่ “อัปเดต” ให้ผ่านเอง
    nextGoal();
    nextMini();

    // ยิง HUD ครั้งแรกแบบ prog=0
    emitHUD('เริ่มเกมแล้ว! แตะของดี เลี่ยงขยะนะ 🥦🍎');
  }

  function update(state) {
    if (ended) return;
    if (!state) state = {};

    if (typeof state.timeLeft === 'number') timeLeft = state.timeLeft;

    if (timeLeft <= 0) {
      emitHUD('หมดเวลาแล้ว ⏱️');
      return;
    }

    // Goal
    if (currentGoal) {
      evalInst(currentGoal, state);
      if (checkFinish(currentGoal)) {
        goalsCleared++;
        coach(`Goal ${goalsCleared}/${maxGoals} ผ่านแล้ว, Mini ${miniCleared}/${maxMini}`);
        if (timeLeft > 0) nextGoal();
      }
    }

    // Mini
    if (currentMini) {
      evalInst(currentMini, state);
      if (checkFinish(currentMini)) {
        miniCleared++;
        coach(`Mini ${miniCleared}/${maxMini} ผ่านแล้ว, Goal ${goalsCleared}/${maxGoals}`);
        if (timeLeft > 0) nextMini(); // ✅ ต่อเนื่อง
      }
    }

    emitHUD();
  }

  function finalize(state) {
    if (ended) return summary();
    ended = true;

    if (!state) state = {};
    const miss = (state.miss | 0);

    function finalizeList(list, isGoalList) {
      for (const inst of list) {
        if (!inst) continue;
        if (inst.kind !== 'missMax') continue;
        if (inst.done) continue;

        const pass = miss <= (inst.target | 0);
        inst.pass = pass;
        inst.done = pass; // ✅ done เฉพาะถ้าผ่าน

        if (pass) {
          if (isGoalList) goalsCleared++;
          else miniCleared++;
        }
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
      goalsAll: goalsAll.slice(),
      minisAll: minisAll.slice()
    };
  }

  function end(state) { return finalize(state); }

  return { start, update, finalize, end, summary };
}

export default { makeQuestDirector };
