// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — Safe Boot Wrapper (PROD FIX)
// ✅ FIX: GoodJunk "ไม่ใช้ mode-factory โดย default" (กันหลุดไปใช้ spawner กลาง/หยดน้ำ)
// ✅ ถ้าต้องการใช้ mode-factory ให้ส่ง opts.useFactory=true เท่านั้น
// ✅ รองรับ GameEngine object, start(), boot(), createEngine(), default export

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

// ---- Helper: ทำให้ starter เรียกได้แบบ (ctx เดียว) เสมอ ----
function adaptStarter(fnOrObj) {
  if (!fnOrObj) return null;

  // function start/boot(ctx) หรือ start(diff, opts)
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

  // object { start() }
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
  if (!engineMod) return null;

  // debug
  try { console.log('[GoodJunkVR] GameEngine exports:', Object.keys(engineMod)); } catch (_) {}

  // 0) default export
  if (engineMod.default) {
    const s0 = adaptStarter(engineMod.default);
    if (s0) return s0;

    if (typeof engineMod.default === 'object' && engineMod.default) {
      if (typeof engineMod.default.boot === 'function') return adaptStarter(engineMod.default.boot);
      if (typeof engineMod.default.start === 'function') return adaptStarter(engineMod.default.start);
      if (engineMod.default.GameEngine && typeof engineMod.default.GameEngine === 'object') {
        const sObj = adaptStarter(engineMod.default.GameEngine);
        if (sObj) return sObj;
      }
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

  // 6) ✅ export createEngine() แล้ว start() ให้เอง
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

  return null;
}

export async function boot(opts = {}) {
  const q = parseQuery(opts.url ? new URL(opts.url) : null);

  const diff = String(opts.diff || q.diff || 'normal').toLowerCase();
  const time = clampInt(opts.time ?? q.time, 20, 180, 60);

  const run = String(opts.run || q.run || '').toLowerCase();
  const challenge = String(opts.challenge || q.challenge || '').toLowerCase();

  // ✅ สำคัญ: GoodJunk default ไม่ใช้ mode-factory (กันเป้าหยดน้ำ/สปอว์นกลาง)
  const useFactory = !!opts.useFactory;

  const engineMod = await loadEngineModule();
  const startEngine = pickEngineStarter(engineMod);

  if (!startEngine) {
    console.error('[GoodJunkVR] ไม่พบตัวเริ่มเกมจาก GameEngine.js (boot/start/GameEngine/makeEngine/createEngine/default)');
    return null;
  }

  // ---- DIRECT START (default) ----
  if (!useFactory) {
    return startEngine({ ...opts, diff, time, run, challenge });
  }

  // ---- OPTIONAL: use mode-factory only when explicitly asked ----
  const factoryBoot = await loadFactoryBoot();
  if (!factoryBoot) {
    console.warn('[GoodJunkVR] mode-factory not found, fallback to direct start');
    return startEngine({ ...opts, diff, time, run, challenge });
  }

  console.log('[GoodJunkVR] using mode-factory (explicit)');
  return factoryBoot({
    mode: 'goodjunk',
    projectTag: 'HeroHealth-GoodJunkVR',
    diff,
    time,
    run,
    challenge,
    engineBoot: (ctx = {}) => startEngine({ ...ctx, ...opts, diff, time, run, challenge })
  });
}

export default { boot };
