// === /herohealth/vr/vr-goodjunk/quest-serial.js ===
// Quest system สำหรับ Good vs Junk VR
// - 1 Main goal (เก็บของดี >= N ชิ้น)
// - Mini quest ต่อเนื่องหลายอัน (คอมโบ x5 -> x8 -> x10 ...)
//   ทำอันหนึ่งครบแล้วจะเลื่อนไปอันถัดไปทันที

'use strict';

// helper ยิง event ออกไปให้ HUD / ระบบอื่นใช้
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {}
}

// main goal: เก็บของดีอย่างน้อย 30 ชิ้น
const DEFAULT_CONFIG = {
  mainTargetGood: 30
};

// mini quest แบบต่อเนื่อง
// สามารถแก้ target / ข้อความทีหลังได้ง่าย ๆ
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
      // main goal
      goodCount: 0,
      junkHits: 0,
      mainTargetGood: DEFAULT_CONFIG.mainTargetGood,
      mainDone: false,

      // combo สถิติภาพรวม
      bestCombo: 0,

      // mini quest ต่อเนื่อง
      miniList: MINI_LIST.map(function (m) {
        return {
          id: m.id,
          label: m.label,
          targetCombo: m.targetCombo,
          cleared: false
        };
      }),
      currentMiniIndex: 0,  // index mini ที่กำลังเล่นอยู่ (0..len)
      miniClearedCount: 0   // ผ่านไปแล้วกี่ mini
    };

    // ให้ HUD หรือส่วนอื่นใช้ได้ง่าย ๆ
    window.hhaMiniCleared = 0;
    window.hhaMiniTotal   = this._state.miniList.length;

    this._emitUpdate();
  },

  stop() {
    // ยังไม่ต้องทำอะไรเพิ่มตอนหยุดเกม
  },

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

  onBad() {
    if (!this._state) return;
    const st = this._state;

    st.junkHits += 1;

    const comboMax = window.comboMax | 0;
    st.bestCombo = Math.max(st.bestCombo, comboMax);

    this._updateDoneFlags();
    this._onComboChange();
    this._emitUpdate();
  },

  onFever() {
    if (!this._state) return;
    // ยังไม่เอา fever มาคิด quest เพิ่ม แค่ให้ HUD อัปเดตได้
    this._emitUpdate();
  },

  _updateDoneFlags() {
    const st = this._state;
    st.mainDone = st.goodCount >= st.mainTargetGood;
  },

  // ตรวจว่าถึงเงื่อนไข mini quest ปัจจุบันหรือยัง
  _onComboChange() {
    const st = this._state;
    const comboNow = window.combo | 0;

    // ยังมี mini quest ให้ทำอยู่หรือไม่
    if (st.currentMiniIndex >= st.miniList.length) {
      return; // ผ่านครบหมดแล้ว
    }

    const mini = st.miniList[st.currentMiniIndex];
    if (!mini.cleared && comboNow >= mini.targetCombo) {
      // ผ่าน mini ปัจจุบัน
      mini.cleared = true;
      st.miniClearedCount += 1;

      // อัปเดต global สำหรับ UI/Research
      window.hhaMiniCleared = st.miniClearedCount;
      window.hhaMiniTotal   = st.miniList.length;

      emit('quest:mini-done', {
        id: mini.id,
        label: mini.label,
        targetCombo: mini.targetCombo,
        clearedCount: st.miniClearedCount
      });

      // ขยับไป mini ถัดไป (ถ้ามี)
      st.currentMiniIndex += 1;

      if (st.currentMiniIndex >= st.miniList.length) {
        // ผ่าน mini quest ครบทุกอันแล้ว
        emit('quest:all-mini-done', {
          clearedCount: st.miniClearedCount,
          total: st.miniList.length
        });
      }
    }
  },

  _emitUpdate() {
    if (!this._state) return;
    const st = this._state;

    const comboNow = window.combo | 0;

    // main goal detail
    const goalDetail = {
      label: 'เก็บของดี (🥦 🍎 🥛) ให้ได้อย่างน้อย 30 ชิ้น',
      progress: {
        current: st.goodCount,
        target: st.mainTargetGood
      },
      done: st.mainDone
    };

    // mini quest detail (อันที่กำลัง active อยู่ ณ ตอนนี้)
    let miniDetail;
    const totalMini = st.miniList.length;

    if (st.currentMiniIndex < totalMini) {
      const mini = st.miniList[st.currentMiniIndex];
      const cur = Math.min(comboNow, mini.targetCombo);

      miniDetail = {
        label: mini.label,
        progress: {
          current: cur,
          target: mini.targetCombo
        },
        done: false, // อันปัจจุบันยังไม่ผ่าน (ถ้าผ่านแล้วจะเลื่อนไปอันใหม่)
        index: st.currentMiniIndex,      // 0-based
        total: totalMini,
        clearedCount: st.miniClearedCount
      };
    } else {
      // ผ่าน mini quest ครบแล้ว
      miniDetail = {
        label: 'ผ่าน Mini quest ครบทุกภารกิจแล้ว 🎉',
        progress: {
          current: 1,
          target: 1
        },
        done: true,
        index: totalMini,
        total: totalMini,
        clearedCount: st.miniClearedCount
      };
    }

    const detail = {
      goal: goalDetail,
      mini: miniDetail,
      hint: 'เล็งของดี 🥦 🍎 🥛 ให้เร็ว ๆ และพยายามไม่โดนของขยะ 🌭🍩 จะได้คอมโบยาว ๆ นะ!'
    };

    // sync global ไว้ให้ส่วนอื่นใช้ (เช่นหน้าสรุปผล / logger)
    window.hhaMiniCleared = st.miniClearedCount;
    window.hhaMiniTotal   = totalMini;

    emit('quest:update', detail);

    if (st.mainDone) emit('quest:goal-done', detail);
  },

  // ให้ GameEngine หรือ logger เรียกตอนจบเกมได้
  getSummary() {
    if (!this._state) return null;
    return {
      mainDone: this._state.mainDone,
      miniCleared: this._state.miniClearedCount,
      miniTotal: this._state.miniList.length
    };
  }
};

export { Quest };
export default Quest;
