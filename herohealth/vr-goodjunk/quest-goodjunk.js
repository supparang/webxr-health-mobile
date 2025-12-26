// === /herohealth/vr-goodjunk/quest-goodjunk.js ===
// Adapter: GoodJunk -> shared quest-director + defs

'use strict';

import { makeQuestDirector } from '../vr/modes/quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export function createVRGoodjunkQuest(diff = 'normal', opts = {}) {
  return makeQuestDirector({
    diff,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 3,
    maxMini:  3,
    onUpdate: (typeof opts.onUpdate === 'function') ? opts.onUpdate : null
  });
}

export default { createVRGoodjunkQuest };