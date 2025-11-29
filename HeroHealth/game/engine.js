// === /HeroHealth/game/engine.js
// Mode Router + Central Controller (2025-11-29) ===
'use strict';

// lazy import แต่ละโหมด
const MODE_BOOTERS = {
  goodjunk : () => import('../modes/goodjunk.safe.js'),
  hydration: () => import('../modes/hydration.safe.js'),
  plate    : () => import('../modes/plate.safe.js'),
  groups   : () => import('../modes/groups.safe.js')
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

  const loader = MODE_BOOTERS[mode] || MODE_BOOTERS.goodjunk;
  const mod    = await loader();

  if (!mod || typeof mod.boot !== 'function') {
    throw new Error(`Mode "${mode}" ไม่มีฟังก์ชัน boot()`);
  }

  let ctrl    = null;
  let started = false;

  async function ensureBooted() {
    if (!ctrl) {
      // แต่ละ safe-mode คืน controller (start/stop/pause/resume) ผ่าน factoryBoot
      ctrl = await mod.boot({ difficulty, duration });
    }
    return ctrl;
  }

  return {
    async start() {
      const c = await ensureBooted();
      if (c && typeof c.start === 'function') {
        c.start();
      }
      started = true;
    },
    async stop() {
      if (!ctrl) return;
      if (typeof ctrl.stop === 'function') {
        ctrl.stop();
      }
      started = false;
    },
    async pause() {
      if (!ctrl || !started) return;
      if (typeof ctrl.pause === 'function') {
        ctrl.pause();
      }
    },
    async resume() {
      if (!ctrl || !started) return;
      if (typeof ctrl.resume === 'function') {
        ctrl.resume();
      }
    }
  };
}

export default { createGameEngine };