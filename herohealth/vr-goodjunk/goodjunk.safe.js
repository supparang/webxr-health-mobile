// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — Safe Boot Wrapper (updated)
// ✅ เพิ่มรองรับ engineMod.createEngine (แล้ว start() ให้เอง)

'use strict';

function clampInt(v, min, max, fallback) {
  v = parseInt(v, 10);
  if (!Number.isFinite(v)) v = fallback;
  if (v < min) v = min;
  if (v > max) v = max;
  return v;
}

function parseQuery(urlObj) {
  const url = urlObj || new URL(window.location.href);

  const diff = String(url.searchParams.get('diff') || 'normal').toLowerCase();
  const time = clampInt(url.searchParams.get('time') || '60', 20, 180, 60);
  const run = String(url.searchParams.get('run') || '').toLowerCase();
  const challenge =
    String(
      url.searchParams.get('challenge') ||
      url.searchParams.get('ch') ||
      url.searchParams.get('mode2') ||
      ''
    ).toLowerCase();

  return { url, diff, time, run, challenge };
}

async function loadFactoryBoot() {
  try {
    const mod = await import('../vr/mode-factory.js');
    if (mod && typeof mod.boot === 'function') return mod.boot;
  } catch (_) {}
  return null;
}

async function loadEngineModule() {
  try {
    return await import('./GameEngine.js');
  } catch (e) {
    console.warn('[GoodJunkVR] import GameEngine.js failed:', e);
    return null;
  }
}

function adaptStarter(fnOrObj) {
  if (!fnOrObj) return null;

  if (typeof fnOrObj === 'function') {
    return (ctx = {}) => {
      try {
        if (fnOrObj.length >= 2) {
          const diff = String(ctx.diff || 'normal').toLowerCase();
          return fnOrObj(diff, ctx);
        }
        return fnOrObj(ctx);
      } catch (e) {
        console.error('[GoodJunkVR] starter() failed:', e);
      }
    };
  }

  if (typeof fnOrObj === 'object' && typeof fnOrObj.start === 'function') {
    return (ctx = {}) => {
      try {
        if (fnOrObj.start.length >= 2) {
          const diff = String(ctx.diff || 'normal').toLowerCase();
          return fnOrObj.start(diff, ctx);
        }
        return fnOrObj.start(ctx);
      } catch (e) {
        console.error('[GoodJunkVR] engine.start() failed:', e);
      }
    };
  }

  return null;
}

function pickEngineStarter(engineMod) {
  if (engineMod) {
    // debug
    try { console.log('[GoodJunkVR] GameEngine exports:', Object.keys(engineMod)); } catch (_) {}

    // 0) default export
    if (engineMod.default) {
      const s0 = adaptStarter(engineMod.default);
      if (s0) return s0;
      if (typeof engineMod.default === 'object' && engineMod.default && typeof engineMod.default.boot === 'function') {
        return adaptStarter(engineMod.default.boot);
      }
      if (typeof engineMod.default === 'object' && engineMod.default && typeof engineMod.default.start === 'function') {
        return adaptStarter(engineMod.default.start);
      }
    }

    // 1) export boot()
    if (typeof engineMod.boot === 'function') return adaptStarter(engineMod.boot);

    // 2) export start()
    if (typeof engineMod.start === 'function') return adaptStarter(engineMod.start);

    // 3) export const GameEngine = {start,stop}
    if (engineMod.GameEngine && typeof engineMod.GameEngine === 'object') {
      const sObj = adaptStarter(engineMod.GameEngine);
      if (sObj) return sObj;
    }

    // 4) export class GameEngine
    if (typeof engineMod.GameEngine === 'function') {
      return (ctx = {}) => {
        try {
          const inst = new engineMod.GameEngine(ctx);
          if (inst && typeof inst.start === 'function') return inst.start();
          if (inst && typeof inst.run === 'function') return inst.run();
          console.error('[GoodJunkVR] GameEngine instance has no start/run');
        } catch (e) {
          console.error('[GoodJunkVR] new GameEngine(ctx) failed:', e);
        }
      };
    }

    // 5) export factory makeEngine()
    if (typeof engineMod.makeEngine === 'function') {
      return (ctx = {}) => {
        try {
          const inst = engineMod.makeEngine(ctx);
          if (inst && typeof inst.start === 'function') return inst.start();
          console.error('[GoodJunkVR] makeEngine() did not return {start()}');
        } catch (e) {
          console.error('[GoodJunkVR] makeEngine(ctx) failed:', e);
        }
      };
    }

    // 6) ✅ export createEngine() แล้ว start ให้เอง
    if (typeof engineMod.createEngine === 'function') {
      return (ctx = {}) => {
        try {
          const inst = engineMod.createEngine(ctx);
          if (inst && typeof inst.start === 'function') return inst.start();
          console.error('[GoodJunkVR] createEngine() did not return {start()}');
        } catch (e) {
          console.error('[GoodJunkVR] createEngine(ctx) failed:', e);
        }
      };
    }
  }

  // fallback global (ไม่แนะนำ แต่กันพัง)
  const w = window;
  const cand =
    w.GoodJunkEngine ||
    w.GoodJunkVR ||
    (w.GAME_MODULES && (w.GAME_MODULES.GoodJunkEngine || w.GAME_MODULES.GoodJunkVR)) ||
    null;

  if (cand) {
    if (typeof cand.boot === 'function') return adaptStarter(cand.boot.bind(cand));
    if (typeof cand.start === 'function') return adaptStarter(cand.start.bind(cand));
    if (cand.GameEngine && typeof cand.GameEngine === 'object') {
      const sObj = adaptStarter(cand.GameEngine);
      if (sObj) return sObj;
    }
  }

  return null;
}

export async function boot(opts = {}) {
  const q = parseQuery(opts.url ? new URL(opts.url) : null);

  const diff = String(opts.diff || q.diff || 'normal').toLowerCase();
  const time = clampInt(opts.time ?? q.time, 20, 180, 60);

  const run = String(opts.run || q.run || '').toLowerCase();
  const challenge = String(opts.challenge || q.challenge || '').toLowerCase();

  const engineMod = await loadEngineModule();
  const startEngine = pickEngineStarter(engineMod);

  if (!startEngine) {
    console.error('[GoodJunkVR] ไม่พบตัวเริ่มเกมจาก GameEngine.js (boot/start/GameEngine/makeEngine/createEngine/default)');
    return;
  }

  const factoryBoot = await loadFactoryBoot();
  if (factoryBoot) {
    console.log('[GoodJunkVR] using mode-factory');
    return factoryBoot({
      mode: 'goodjunk',
      projectTag: 'HeroHealth-GoodJunkVR',
      diff,
      time,
      run,
      challenge,
      engineBoot: (ctx = {}) => startEngine({ ...ctx, diff, time, run, challenge })
    });
  }

  return startEngine({ diff, time, run, challenge });
}

export default { boot };
