// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Safe Boot (ESM)
// ✅ Provides named export: boot
// ✅ Works even if GameEngine exports differ (GameEngine / createEngine / default / boot / start)

'use strict';

import * as EngineMod from './GameEngine.js';

function pickStarter(mod) {
  if (!mod) return null;

  // preferred: createEngine(ctx) -> instance(start/run optional)
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

  // default export: function or object with boot/start
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

  // fallback named boot/start
  if (typeof mod.boot === 'function')  return (ctx = {}) => mod.boot(ctx);
  if (typeof mod.start === 'function') return (ctx = {}) => mod.start(ctx);

  return null;
}

export function boot(opts = {}) {
  const start = pickStarter(EngineMod);
  if (!start) {
    console.error('[GoodJunkVR] goodjunk.safe.js: cannot find engine starter. Exports=', Object.keys(EngineMod || {}));
    return null;
  }
  try {
    return start(opts);
  } catch (e) {
    console.error('[GoodJunkVR] boot failed:', e);
    return null;
  }
}

// เผื่อไฟล์อื่นอ้าง
export const GameEngine  = EngineMod.GameEngine;
export const createEngine = EngineMod.createEngine;

export default { boot, GameEngine, createEngine };