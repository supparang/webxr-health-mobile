// === /herohealth/hydration-vr/hydration.quest.js ===
// ระบบ Quest/Goals สำหรับโหมด Hydration VR

'use strict';

import { MissionDeck } from '../vr/mission.js';

// goals / mini จากไฟล์แยก
import hydrationGoalsFor from './hydration.goals.js';
import hydrationMinisFor from './hydration.minis.js';

// state helper
import { mapHydrationState, normalizeHydrationDiff } from './hydration.state.js';

/**
 * Create Quest Deck for Hydration Mode
 * diff = easy | normal | hard
 */
export function createHydrationQuest(diff = 'normal') {
  const D = normalizeHydrationDiff(diff);

  // โหลดตาราง goals / minis
  const goals = hydrationGoalsFor(D);
  const minis = hydrationMinisFor(D);

  // ใช้ MissionDeck กลาง
  const deck = new MissionDeck({
    goals,
    minis,

    // map state ที่ใช้เช็คโปรเกรส
    mapState: s => mapHydrationState(s),

    // ให้ goals/missions ผ่านแบบสุ่มที่ไม่ซ้ำ
    drawGoalCount: 2,
    drawMiniCount: 3
  });

  // เตรียมสถิติเฉพาะ Hydration
  deck.stats = {
    greenTick: 0,
    zone: 'GREEN'
  };

  return deck;
}

export default { createHydrationQuest };