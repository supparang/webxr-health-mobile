// === /herohealth/vr/vr-goodjunk/quest-serial.js ===
// Quest system สำหรับ Good vs Junk VR
// - 1 Main goal (เก็บของดี >= 30 ชิ้น)
// - Mini quest ต่อเนื่องหลายอัน (คอมโบ x5 -> x8 -> x10 ...)

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
      currentMiniIndex: 0,
      miniClearedCount: 0
    };

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
    this._emitUpdate();
  },

  _updateDoneFlags() {
    const st = this._state;
    st.mainDone = st.goodCount >= st.mainTargetGood;
  },

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

  _emitUpdate() {
    if (!this._state) return;
    const st = this._state;

    const comboNow = window.combo | 0;

    const goalDetail = {
      label: 'เก็บของดี (🥦 🍎 🥛) ให้ได้อย่างน้อย 30 ชิ้น',
      progress: {
        current: st.goodCount,
        target: st.mainTargetGood
      },
      done: st.mainDone
    };

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
        done: false,
        index: st.currentMiniIndex,
        total: totalMini,
        clearedCount: st.miniClearedCount
      };
    } else {
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

    window.hhaMiniCleared = st.miniClearedCount;
    window.hhaMiniTotal   = totalMini;

    emit('quest:update', detail);

    if (st.mainDone) emit('quest:goal-done', detail);
  },

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
