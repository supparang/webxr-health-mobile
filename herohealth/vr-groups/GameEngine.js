// แทนที่ฟังก์ชันเดิมทั้งก้อนด้วยอันนี้

function emitStat (state, extra = {}) {
  const q = state.questSummary || {};

  try {
    window.dispatchEvent(new CustomEvent('hha:stat', {
      detail: {
        // โหมดเกม
        mode: 'Food Groups',
        difficulty: state.diff,

        // ----- คะแนน / คอมโบ / MISS (ตัวหลัก) -----
        score:    state.score || 0,
        combo:    state.combo || 0,
        comboMax: state.comboMax || 0,
        misses:   state.misses || 0,

        // ----- alias ให้ HUD / logger รุ่นเก่าอ่านได้ -----
        scoreTotal: state.score || 0,      // ใช้แทน scoreTotal เดิม
        comboBest:  state.comboMax || 0,   // ใช้แทน comboBest เดิม
        miss:       state.misses || 0,     // ใช้แทน miss เดิม

        // ----- Fever -----
        fever:       state.fever || 0,
        feverActive: !!state.feverActive,

        // ----- Quest summary -----
        goalsCleared:  q.clearedGoals  || 0,
        goalsTotal:    q.totalGoals    || 0,
        questsCleared: q.clearedMinis  || 0,
        questsTotal:   q.totalMinis    || 0,

        // เผื่อส่งค่าอื่นเพิ่ม เช่น ended: true ตอนจบเกม
        ...extra
      }
    }));
  } catch (err) {
    console.warn('[GroupsVR] emitStat error', err);
  }
}
