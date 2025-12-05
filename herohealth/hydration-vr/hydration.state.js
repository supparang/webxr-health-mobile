// === /herohealth/hydration-vr/hydration.state.js ===
// Helper สำหรับโหมด Hydration (ใช้ร่วมใน goals/minis/quest)

/**
 * แปลง state จาก MissionDeck / deck.stats
 * ให้เป็นฟอร์แมตเดียวที่ goals / minis ใช้เช็คเงื่อนไขได้ง่าย
 */
export function mapHydrationState(s = {}) {
  const src = s || {};
  return {
    // คะแนนรวมขณะนั้น
    score:    src.score      | 0,

    // คอมโบปัจจุบัน + คอมโบสูงสุด
    combo:    src.combo      | 0,
    comboMax: src.comboMax   | 0,

    // นับจำนวนของดีที่เก็บได้ (GOOD count)
    good:     src.goodCount  | 0,

    // นับจำนวนครั้งที่ "พลาดของไม่ดี" ตามที่ MissionDeck เก็บไว้
    // (เช่น ปล่อย BAD หลุด / ตี BAD โดยไม่มี shield)
    miss:     src.junkMiss   | 0,

    // เวลาเล่นสะสม (วินาที) – MissionDeck.second() จะอัปเดต field นี้
    tick:     src.tick       | 0,

    // เวลา “อยู่ในโซน GREEN” สะสม (วินาที)
    // เราอัปเดตค่า greenTick ให้ deck.stats จาก hydration.safe.js
    green:    src.greenTick  | 0
  };
}

/**
 * ปรับค่า diff ให้ปลอดภัย
 * ถ้าไม่ใช่ easy / normal / hard → บีบกลับเป็น normal
 */
export function normalizeHydrationDiff(diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy' || d === 'normal' || d === 'hard') return d;
  return 'normal';
}

export default {
  mapHydrationState,
  normalizeHydrationDiff
};