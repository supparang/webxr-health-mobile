'use strict';

// Bridge: keep old import path working
// goodjunk.safe.js imports "./quest-director.js"
// so we forward to the compat director that supports targetByDiff/label.

export { makeQuestDirector } from './quest-director-goodjunk.js';
export { makeGoodJunkQuestDirector } from './quest-director-goodjunk.js';