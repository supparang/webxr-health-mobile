// === /herohealth/hydration-vr/hydration.state.js
// Helper สำหรับโหมด Hydration (ใช้ร่วมใน goals/minis)

export function mapHydrationState(s = {}) {
  return {
    score:    s.score      | 0,
    combo:    s.combo      | 0,
    comboMax: s.comboMax   | 0,
    good:     s.goodCount  | 0,
    miss:     s.junkMiss   | 0, // จำนวนโดนน้ำหวาน / ผิดพลาดในเด็ค
    tick:     s.tick       | 0, // เวลาเล่นสะสม (วินาที)
    green:    s.greenTick  | 0  // เวลา “อยู่ GREEN” สะสม (อัปเดตจาก hydration.safe.js)
  };
}

// ปรับ diff ให้ปลอดภัย (ถ้าไม่ได้ easy/hard → normal)
export function normalizeHydrationDiff(diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'normal';
}

// เผื่อกรณี import default
export default {
  mapHydrationState,
  normalizeHydrationDiff
};
