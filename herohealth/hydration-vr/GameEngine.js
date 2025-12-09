// === /herohealth/hydration-vr/GameEngine.js ===
// Bridge ระหว่าง hydration-vr.html <-> hydration.safe.js + mode-factory

'use strict';

import { boot as bootHydration } from './hydration.safe.js';

let inst = null;
let running = false;

export const GameEngine = {
  async start(diff = 'normal', durationSec = 60) {
    if (running) return;
    running = true;

    try {
      inst = await bootHydration({
        difficulty: diff,
        duration: durationSec
      });
    } catch (err) {
      console.error('[HydrationVR] boot error:', err);
      running = false;
    }
  },

  stop(reason = 'manual') {
    if (!running) return;
    running = false;

    try {
      if (inst && typeof inst.stop === 'function') {
        inst.stop(reason);
      }
    } catch (err) {
      console.warn('[HydrationVR] stop error:', err);
    } finally {
      inst = null;
    }
  }
};

export default GameEngine;
