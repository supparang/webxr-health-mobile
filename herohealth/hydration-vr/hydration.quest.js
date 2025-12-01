// === /HeroHealth/modes/hydration.quest.js
// Glue file สำหรับ MissionDeck ของโหมด Hydration
// (โครงสร้างเหมือน goodjunk.quest.js / groups.quest.js)

import { MissionDeck } from './mission.js';
import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';

export function createHydrationQuest(diff = 'normal') {
  return new MissionDeck({
    goalPool: hydrationGoalsFor(diff),
    miniPool: hydrationMinisFor(diff)
  });
}

export default { createHydrationQuest };
