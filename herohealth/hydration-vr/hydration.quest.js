// === /herohealth/hydration-vr/hydration.quest.js
// Glue file สำหรับ MissionDeck ของโหมด Hydration

import { MissionDeck } from '../vr/mission.js';        // << สำคัญ: ../vr/mission.js
import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';

export function createHydrationQuest(diff = 'normal') {
  return new MissionDeck({
    goalPool: hydrationGoalsFor(diff),
    miniPool: hydrationMinisFor(diff)
  });
}

export default { createHydrationQuest };
