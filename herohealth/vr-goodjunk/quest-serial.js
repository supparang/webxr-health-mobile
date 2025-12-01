// === /herohealth/vr/vr-goodjunk/quest-serial.js ===
// Quest system สำหรับ Good vs Junk VR (Goal + Mini quest + Progress)

'use strict';

// ใช้ emit ชื่อ event เดียวกับระบบหลัก
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {}
}

const DEFAULT_CONFIG = {
  mainTargetGood: 30,   // เก็บของดีอย่างน้อย 30 ชิ้น
  miniTargetCombo: 10   // ทำคอมโบให้ถึง x10
};

const Quest = {
  _state: null,

  start() {
    this._state = {
      goodCount: 0,
      junkHits: 0,
      bestCombo: 0,
      mainTargetGood: DEFAULT_CONFIG.mainTargetGood,
      miniTargetCombo: DEFAULT_CONFIG.miniTargetCombo,
      mainDone: false,
      miniDone: false
    };
    this._emitUpdate();
  },

  stop() {
    // ยังไม่ต้องทำอะไรเพิ่มตอนหยุด
  },

  onGood() {
    if (!this._state) return;
    const st = this._state;

    st.goodCount += 1;

    // combo ปัจจุบัน/สูงสุด อ่านจาก global
    const comboNow = (window.combo | 0);
    const comboMax = (window.comboMax | 0);
    st.bestCombo = Math.max(st.bestCombo, comboNow, comboMax);

    this._updateDoneFlags();
    this._emitUpdate();
  },

  onBad() {
    if (!this._state) return;
    const st = this._state;

    st.junkHits += 1;

    // อัปเดต best combo จากค่า global เผื่อดีดขึ้นจากที่อื่น
    const comboMax = (window.comboMax | 0);
    st.bestCombo = Math.max(st.bestCombo, comboMax);

    this._updateDoneFlags();
    this._emitUpdate();
  },

  onFever() {
    // ถ้าอยากใช้ Fever เป็นเงื่อนไข Quest เพิ่มทีหลังได้
    if (!this._state) return;
    this._emitUpdate();
  },

  _updateDoneFlags() {
    const st = this._state;
    st.mainDone = st.goodCount >= st.mainTargetGood;
    st.miniDone = st.bestCombo >= st.miniTargetCombo;
  },

  _emitUpdate() {
    if (!this._state) return;
    const st = this._state;

    const detail = {
      goal: {
        label: 'เก็บของดี (🥦 🍎 🥛) ให้ได้อย่างน้อย 30 ชิ้น',
        progress: {
          current: st.goodCount,
          target: st.mainTargetGood
        },
        done: st.mainDone
      },
      mini: {
        label: 'ทำคอมโบให้ถึง x10',
        progress: {
          current: st.bestCombo,
          target: st.miniTargetCombo
        },
        done: st.miniDone
      },
      hint: 'เล็งของดี 🥦 🍎 🥛 ให้เร็ว ๆ และพยายามไม่โดนของขยะ 🌭🍩 จะได้คอมโบยาว ๆ นะ!'
    };

    emit('quest:update', detail);

    // ถ้าผ่านแล้ว ยิง event เพิ่ม เผื่ออนาคตจะใช้เล่น effect
    if (st.mainDone) emit('quest:goal-done', detail);
    if (st.miniDone) emit('quest:mini-done', detail);
    if (st.mainDone && st.miniDone) emit('quest:all-done', detail);
  }
};

export { Quest };
export default Quest;
