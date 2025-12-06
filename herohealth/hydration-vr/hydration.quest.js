// === /herohealth/hydration-vr/hydration.quest.js ===
// ใช้ MissionDeck แบบเดียวกับ GoodJunk / Groups เพื่อสุ่ม Goal + Mini จริง ๆ

import { MissionDeck } from '../vr/mission.js';
import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';
import { normalizeHydrationDiff } from './hydration.state.js';

// จัดลำดับ mission: ง่าย → ปานกลาง → ยาก (พลาดไม่เกิน อยู่ท้ายสุดเสมอ)
function sortMissions(pool, diff) {
  const diffKey = diff || 'normal';

  return (pool || [])
    .filter(m => {
      const text = (m.label || m.title || m.text || m.desc || '').toString();
      const isMissLimit = /พลาดไม่เกิน|miss/i.test(text);

      // ในโหมด easy ไม่ใช้ mission แบบ “พลาดไม่เกิน …” เลย
      if (diffKey === 'easy' && isMissLimit) return false;
      return true;
    })
    .map(m => {
      const text = (m.label || m.title || m.text || m.desc || '').toString();
      const isMissLimit = /พลาดไม่เกิน|miss/i.test(text);

      // ถ้ามี tier/level/diffRank อยู่แล้วก็ใช้เลย
      let tier = m.tier ?? m.level ?? m.diffRank;

      // ถ้าไม่มีกำหนด tier ให้เดาแบบง่าย ๆ
      if (tier == null) {
        if (diffKey === 'easy') {
          tier = 1;                // easy: ส่วนใหญ่ให้ง่าย
        } else if (diffKey === 'normal') {
          tier = isMissLimit ? 3 : 2;
        } else { // hard
          tier = isMissLimit ? 3 : 2;
        }
      }

      // flag ไว้เพื่อดัน “พลาดไม่เกิน …” ไปหลังสุดเสมอ
      const missLast = isMissLimit ? 1 : 0;

      return { ...m, _tier: tier, _missLast: missLast };
    })
    .sort((a, b) => {
      if (a._tier !== b._tier) return a._tier - b._tier;         // tier น้อย (ง่าย) ก่อน
      if (a._missLast !== b._missLast) return a._missLast - b._missLast; // miss-limit ไปท้ายสุด
      return 0;
    });
}

export function createHydrationQuest(diffRaw = 'normal') {
  // ปรับ diff ให้เหลือ easy / normal / hard
  const diff = normalizeHydrationDiff(diffRaw);

  // ดึงรายการ goal / mini สำหรับโหมดนี้และจัดลำดับ
  const goalPoolRaw = hydrationGoalsFor(diff);
  const miniPoolRaw = hydrationMinisFor(diff);

  const goalPool = sortMissions(goalPoolRaw, diff);
  const miniPool = sortMissions(miniPoolRaw, diff);

  // ให้ MissionDeck จัดการระบบสุ่ม + นับสถิติ (score, combo, goodCount, junkMiss, tick ฯลฯ)
  return new MissionDeck({
    goalPool,
    miniPool
  });
}

export default { createHydrationQuest };
