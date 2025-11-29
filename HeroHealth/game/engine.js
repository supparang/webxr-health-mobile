// === /HeroHealth/game/engine.js (Static imports – ทุกโหมดมีเป้าแน่นอน) ===
'use strict';

import * as GoodJunkMode from '../modes/goodjunk.safe.js';
import * as HydrationMode from '../modes/hydration.safe.js';
import * as PlateMode     from '../modes/plate.safe.js';
import * as GroupsMode    from '../modes/groups.safe.js';

const MODE_TABLE = {
  goodjunk : GoodJunkMode,
  hydration: HydrationMode,
  plate    : PlateMode,
  groups   : GroupsMode
};

/**
 * createGameEngine({ mode, difficulty, duration })
 * - mode: 'goodjunk' | 'hydration' | 'plate' | 'groups'
 * - difficulty: 'easy' | 'normal' | 'hard'
 * - duration: วินาที
 */
export async function createGameEngine({
  mode = 'goodjunk',
  difficulty = 'normal',
  duration = 60
} = {}) {
  mode       = (mode || 'goodjunk').toLowerCase();
  difficulty = (difficulty || 'normal').toLowerCase();
  duration   = (+duration | 0) || 60;

  const mod = MODE_TABLE[mode] || MODE_TABLE.goodjunk;
  if (!mod || typeof mod.boot !== 'function') {
    throw new Error(`Mode "${mode}" ไม่มีฟังก์ชัน boot()`);
  }

  // รองรับทั้ง boot แบบ sync และ async
  const maybe = mod.boot({ difficulty, duration });
  const ctrl  = (maybe && typeof maybe.then === 'function')
    ? await maybe
    : maybe;

  return {
    start()  { if (ctrl && typeof ctrl.start  === 'function') ctrl.start(); },
    stop()   { if (ctrl && typeof ctrl.stop   === 'function') ctrl.stop(); },
    pause()  { if (ctrl && typeof ctrl.pause  === 'function') ctrl.pause(); },
    resume() { if (ctrl && typeof ctrl.resume === 'function') ctrl.resume(); }
  };
}

export default { createGameEngine };