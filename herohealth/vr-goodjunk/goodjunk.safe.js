// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// Safe boot wrapper for GoodJunkVR
// ✅ FIX: export named "boot" so goodjunk-vr.boot.js can import it
// ✅ Uses createEngine() if provided, else GameEngine class, else default

'use strict';

import * as EngineMod from './GameEngine.js';

function pickStarter(mod) {
  if (!mod) return null;

  // prefer createEngine(ctx)
  if (typeof mod.createEngine === 'function') {
    return (ctx = {}) => {
      const inst = mod.createEngine(ctx);
      if (inst && typeof inst.start === 'function') { inst.start(); return inst; }
      if (inst && typeof inst.run === 'function')   { inst.run();   return inst; }
      return inst;
    };
  }

  // class GameEngine
  if (typeof mod.GameEngine === 'function') {
    return (ctx = {}) => {
      const inst = new mod.GameEngine(ctx);
      if (inst && typeof inst.start === 'function') { inst.start(); return inst; }
      if (inst && typeof inst.run === 'function')   { inst.run();   return inst; }
      return inst;
    };
  }

  // default export may be function or object with start/boot
  if (mod.default) {
    if (typeof mod.default === 'function') {
      return (ctx = {}) => mod.default(ctx);
    }
    if (typeof mod.default.boot === 'function') {
      return (ctx = {}) => mod.default.boot(ctx);
    }
    if (typeof mod.default.start === 'function') {
      return (ctx = {}) => { mod.default.start(ctx); return mod.default; };
    }
  }

  // named boot/start
  if (typeof mod.boot === 'function')  return (ctx = {}) => mod.boot(ctx);
  if (typeof mod.start === 'function') return (ctx = {}) => mod.start(ctx);

  return null;
}

export function boot(opts = {}) {
  const start = pickStarter(EngineMod);
  if (!start) {
    console.error('[GoodJunkVR] goodjunk.safe.js: cannot find engine starter in GameEngine.js exports:', Object.keys(EngineMod||{}));
    return null;
  }
  try {
    return start(opts);
  } catch (e) {
    console.error('[GoodJunkVR] boot failed:', e);
    return null;
  }
}

// re-export ให้ของเดิมไม่พัง
export const GameEngine = EngineMod.GameEngine;
export const createEngine = EngineMod.createEngine;

export default { boot, GameEngine, createEngine };