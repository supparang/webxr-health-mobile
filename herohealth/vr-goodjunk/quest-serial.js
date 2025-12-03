// === /herohealth/vr-goodjunk/quest-serial.js ===
// Quest system สำหรับ Good vs Junk VR
// - Main goals 2 อัน:
//    1) เก็บของดีให้ครบตามเป้า
//    2) แตะอาหารขยะไม่เกิน N ครั้ง (missMax)
// - Mini quest แบบต่อเนื่องตามคอมโบ

'use strict';

// helper ยิง event ออกไปให้ HUD / ระบบอื่นใช้
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {}
}

// config หลัก
const DEFAULT_CONFIG = {
  mainTargetGood: 30, // เก็บของดีอย่างน้อย 30 ชิ้น
  missMaxLimit: 6     // แตะของขยะได้ไม่เกิน 6 ครั้ง
};

// mini quest แบบต่อเนื่อง (ตามคอมโบ)
const MINI_LIST = [
  {
    id: 'combo5',
    label: 'ทำคอมโบให้ถึง x5',
    targetCombo: 5
  },
  {
    id: 'combo8',
    label: 'ดันคอมโบให้ถึง x8',
    targetCombo: 8
  },
  {
    id: 'combo10',
    label: 'ท้าทาย! ทำคอมโบให้ถึง x10',
    targetCombo: 10
  }
];

const Quest = {
  _state: null,

  start() {
    this._state = {
      // main stats
      goodCount: 0,                   // เก็บของดีไปแล้วกี่ชิ้น
      junkHits: 0,                    // แตะของขยะไปแล้วกี่ครั้ง (= miss)
      mainTargetGood: DEFAULT_CONFIG.mainTargetGood,
      missMaxLimit: DEFAULT_CONFIG.missMaxLimit,

      mainDone: false,                // ผ่านเป้าเก็บของดีหรือยัง
      missGoalDone: true,             // เป้าไม่เกิน N ครั้ง (เริ่มต้น = true เพราะยังไม่ miss)

      // combo สถิติภาพรวม
      bestCombo: 0,

      // mini quest ต่อเนื่อง
      miniList: MINI_LIST.map(m => ({
        id: m.id,
        label: m.label,
        targetCombo: m.targetCombo,
        cleared: false
      })),
      currentMiniIndex: 0,
      miniClearedCount: 0
    };

    // ค่า global ใช้ใน logger/summary
    window.hhaMiniCleared = 0;
    window.hhaMiniTotal   = this._state.miniList.length;

    this._emitUpdate();
  },

  stop() {
    // ยังไม่ต้องทำอะไรตอนหยุดเกม
  },

  // เรียกเมื่อยิงโดน "ของดี"
  onGood() {
    if (!this._state) return;
    const st = this._state;

    st.goodCount += 1;

    const comboNow = window.combo | 0;
    const comboMax = window.comboMax | 0;
    st.bestCombo = Math.max(st.bestCombo, comboNow, comboMax);

    this._updateDoneFlags();
    this._onComboChange();
    this._emitUpdate();
  },

  // เรียกเมื่อยิงโดน "ของขยะ"
  onBad() {
    if (!this._state) return;
    const st = this._state;

    st.junkHits += 1; // นับ miss

    const comboMax = window.comboMax | 0;
    st.bestCombo = Math.max(st.bestCombo, comboMax);

    this._updateDoneFlags();
    this._onComboChange();
    this._emitUpdate();
  },

  onFever() {
    if (!this._state) return;
    this._emitUpdate();
  },

  // อัปเดตสถานะ ผ่าน/ไม่ผ่าน เป้าหมายหลัก
  _updateDoneFlags() {
    const st = this._state;
    st.mainDone     = st.goodCount >= st.mainTargetGood;
    st.missGoalDone = st.junkHits  <= st.missMaxLimit;
  },

  // เช็กว่าผ่าน mini quest ตัวปัจจุบันหรือยัง (ตามคอมโบ)
  _onComboChange() {
    const st = this._state;
    const comboNow = window.combo | 0;

    if (st.currentMiniIndex >= st.miniList.length) {
      return; // ผ่านทุก mini แล้ว
    }

    const mini = st.miniList[st.currentMiniIndex];
    if (!mini.cleared && comboNow >= mini.targetCombo) {
      mini.cleared = true;
      st.miniClearedCount += 1;

      window.hhaMiniCleared = st.miniClearedCount;
      window.hhaMiniTotal   = st.miniList.length;

      emit('quest:mini-done', {
        id: mini.id,
        label: mini.label,
        targetCombo: mini.targetCombo,
        clearedCount: st.miniClearedCount
      });

      st.currentMiniIndex += 1;

      if (st.currentMiniIndex >= st.miniList.length) {
        emit('quest:all-mini-done', {
          clearedCount: st.miniClearedCount,
          total: st.miniList.length
        });
      }
    }
  },

  // ยิงสถานะล่าสุดให้ HUD
  _emitUpdate() {
    if (!this._state) return;
    const st = this._state;

    const comboNow = window.combo | 0;

    // ---- Main goals ----

    // เป้าเก็บของดี
    const goodGoal = {
      id: 'G_GOOD_30',
      kind: 'goodHits',
      label: 'เก็บของดี (🥦 🍎 🥛) ให้ได้อย่างน้อย 30 ชิ้น',
      prog: st.goodCount,
      target: st.mainTargetGood,
      done: st.mainDone
    };

    // เป้าแตะของขยะไม่เกิน missMaxLimit ครั้ง (missMax)
    const missGoal = {
      id: 'G_MISS_MAX',
      kind: 'missMax',
      label: `แตะอาหารขยะไม่เกิน ${st.missMaxLimit} ครั้ง`,
      // prog ใช้สำหรับความยาวแถบ (ไม่ให้เกิน target)
      prog: Math.min(st.junkHits, st.missMaxLimit),
      // value = จำนวนจริง (8, 10, ...), เอาไว้ทำ caption "8 / ≤6 (เกินเป้า)"
      value: st.junkHits,
      target: st.missMaxLimit,
      done: st.missGoalDone,              // true ถ้า <= limit
      failed: !st.missGoalDone,          // true ถ้าเกินเป้า
      overBy: Math.max(0, st.junkHits - st.missMaxLimit)
    };

    // ตอนนี้เลือกให้ HUD โชว์เป้า missMax เป็นหลัก (จะได้รู้ว่าพลาดเยอะไปไหม)
    const activeGoal = missGoal;

    // ---- Mini quest ต่อเนื่อง ----
    let miniDetail;
    const totalMini = st.miniList.length;

    if (st.currentMiniIndex < totalMini) {
      const mini = st.miniList[st.currentMiniIndex];
      const cur = Math.min(comboNow, mini.targetCombo);

      miniDetail = {
        id: mini.id,
        kind: 'combo',
        label: mini.label,
        prog: cur,
        target: mini.targetCombo,
        done: false,
        index: st.currentMiniIndex,
        total: totalMini,
        clearedCount: st.miniClearedCount
      };
    } else {
      miniDetail = {
        id: 'ALL_MINI_DONE',
        kind: 'combo',
        label: 'ผ่าน Mini quest ครบทุกภารกิจแล้ว 🎉',
        prog: 1,
        target: 1,
        done: true,
        index: totalMini,
        total: totalMini,
        clearedCount: st.miniClearedCount
      };
    }

    const goalsCleared =
      (st.mainDone ? 1 : 0) +
      (st.missGoalDone ? 1 : 0);
    const goalsTotal = 2;

    const detail = {
      goal: activeGoal,      // อันที่ HUD ด้านขวาเอาไปแสดง
      mini: miniDetail,

      // ข้อมูลเสริม ถ้าอยากโชว์ทั้งสองเป้าพร้อมกันใน HUD ภายหลัง
      goals: {
        good: goodGoal,
        missMax: missGoal
      },
      goalsCleared,
      goalsTotal,

      hint: 'เล็งของดี 🥦 🍎 🥛 ให้เร็ว ๆ และพยายามไม่โดนของขยะ 🌭🍩 จะได้คอมโบยาว ๆ นะ!'
    };

    window.hhaMiniCleared = st.miniClearedCount;
    window.hhaMiniTotal   = totalMini;

    emit('quest:update', detail);

    if (st.mainDone) {
      emit('quest:goal-done', detail);
    }
  },

  // สรุปให้ GameEngine / logger ใช้ตอนจบเกม
  getSummary() {
    if (!this._state) return null;
    const st = this._state;

    const goalsCleared =
      (st.mainDone ? 1 : 0) +
      (st.missGoalDone ? 1 : 0);
    const goalsTotal = 2;

    return {
      mainDone: st.mainDone,
      missGoalDone: st.missGoalDone,
      goalsCleared,
      goalsTotal,
      miniCleared: st.miniClearedCount,
      miniTotal: st.miniList.length
    };
  }
};

export { Quest };
export default Quest;
