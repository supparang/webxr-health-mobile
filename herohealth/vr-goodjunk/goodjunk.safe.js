// === /herohealth/vr/goodjunk.safe.js ===
// Safe boot wrapper for GoodJunkVR (placed in /vr)
// ✅ export named "boot" for /vr/goodjunk-vr.boot.js
// ✅ pulls engine from ../vr-goodjunk/GameEngine.js

'use strict';

import * as EngineMod from '../vr-goodjunk/GameEngine.js';

function pickStarter(mod) {
  if (!mod) return null;

  if (typeof mod.createEngine === 'function') {
    return (ctx = {}) => {
      const inst = mod.createEngine(ctx);
      if (inst && typeof inst.start === 'function') { inst.start(); return inst; }
      if (inst && typeof inst.run === 'function')   { inst.run();   return inst; }
      return inst;
    };
  }

  if (typeof mod.GameEngine === 'function') {
    return (ctx = {}) => {
      const inst = new mod.GameEngine(ctx);
      if (inst && typeof inst.start === 'function') { inst.start(); return inst; }
      if (inst && typeof inst.run === 'function')   { inst.run();   return inst; }
      return inst;
    };
  }

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

  if (typeof mod.boot === 'function')  return (ctx = {}) => mod.boot(ctx);
  if (typeof mod.start === 'function') return (ctx = {}) => mod.start(ctx);

  return null;
}

export function boot(opts = {}) {
  const start = pickStarter(EngineMod);
  if (!start) {
    console.error('[GoodJunkVR] /vr/goodjunk.safe.js: cannot find engine starter. Exports:', Object.keys(EngineMod||{}));
    return null;
  }
  try {
    return start(opts);
  } catch (e) {
    console.error('[GoodJunkVR] boot failed:', e);
    return null;
  }
}

// re-export เผื่อไฟล์อื่นยังเรียก
export const GameEngine = EngineMod.GameEngine;
export const createEngine = EngineMod.createEngine;

export default { boot, GameEngine, createEngine };