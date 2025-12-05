// === /herohealth/hydration-vr/hydration.quest.js ===
// ใช้ MissionDeck แบบเดียวกับ GoodJunk / Groups เพื่อสุ่ม Goal + Mini จริง ๆ

import { MissionDeck } from '../vr/mission.js';
import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';
import { normalizeHydrationDiff } from './hydration.state.js';

export function createHydrationQuest(diffRaw = 'normal') {
  // ปรับ diff ให้เหลือ easy / normal / hard
  const diff = normalizeHydrationDiff(diffRaw);

  // ดึงรายการ goal / mini สำหรับโหมดนี้
  const goalPool = hydrationGoalsFor(diff);
  const miniPool = hydrationMinisFor(diff);

  // ให้ MissionDeck จัดการระบบสุ่ม + นับสถิติ (score, combo, goodCount, junkMiss, tick ฯลฯ)
  return new MissionDeck({
    goalPool,
    miniPool
  });
}

export default { createHydrationQuest };
