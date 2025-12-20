// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — Safe Boot Wrapper (AUTO-DETECT ENGINE FILE)
// ✅ export named: boot
// ✅ tries engine module candidates like ./game-engine-goodjunk-*.js
// ✅ fallback: window.GameEngine / window.GoodJunkEngine / GAME_MODULES...

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
    String(url.searchParams.get('challenge') || url.searchParams.get('ch') || '').toLowerCase();
  return { url, diff, time, run, challenge };
}

async function loadFactoryBoot() {
  try {
    const mod = await import('../vr/mode-factory.js');
    if (mod && typeof mod.boot === 'function') return mod.boot;
  } catch (_) {}
  return null;
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
        return null;
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
        return null;
      }
    };
  }

  return null;
}

function pickEngineStarter(engineMod) {
  if (!engineMod) return null;

  // default
  if (engineMod.default) {
    const s0 = adaptStarter(engineMod.default);
    if (s0) return s0;
    if (engineMod.default && typeof engineMod.default.boot === 'function') return adaptStarter(engineMod.default.boot);
    if (engineMod.default && typeof engineMod.default.start === 'function') return adaptStarter(engineMod.default.start);
  }

  // named
  if (typeof engineMod.boot === 'function') return adaptStarter(engineMod.boot);
  if (typeof engineMod.start === 'function') return adaptStarter(engineMod.start);

  // object
  if (engineMod.GameEngine && typeof engineMod.GameEngine === 'object') {
    const sObj = adaptStarter(engineMod.GameEngine);
    if (sObj) return sObj;
  }

  // factory -> instance.start()
  if (typeof engineMod.createEngine === 'function') {
    return (ctx = {}) => {
      try {
        const inst = engineMod.createEngine(ctx);
        if (inst && typeof inst.start === 'function') {
          inst.start();
          return inst;
        }
        console.error('[GoodJunkVR] createEngine() did not return {start()}');
      } catch (e) {
        console.error('[GoodJunkVR] createEngine(ctx) failed:', e);
      }
      return null;
    };
  }

  // class
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
      return null;
    };
  }

  return null;
}

async function tryImportOne(path) {
  try {
    const m = await import(path);
    return m || null;
  } catch (e) {
    return null;
  }
}

/**
 * ✅ สำคัญ: โฟลเดอร์คุณใช้ชื่อไฟล์แบบ `game-engine-goodjunk-...js`
 * ดังนั้นเราลอง candidate หลายชื่อให้ครอบคลุม
 */
async function loadEngineModuleAuto() {
  const candidates = [
    './GameEngine.js',
    './game-engine-goodjunk.js',
    './game-engine-goodjunk-vr.js',
    './game-engine-goodjunk-vr.mobile.js',
    './game-engine-goodjunk-vr-mobile.js',
    './game-engine-goodjunk-vr-mobile-controller.js',
    './game-engine-goodjunk-vr-mobile-controls.js',
    './game-engine-goodjunk-main.js',

    // เผื่อคุณตั้งชื่อไฟล์ยาว/มี suffix
    './game-engine-goodjunk-vr-prod.js',
    './game-engine-goodjunk-v3.js',
    './game-engine-goodjunk-vr-v3.js'
  ];

  for (const p of candidates) {
    const mod = await tryImportOne(p);
    if (mod) return { mod, path: p };
  }

  // fallback: ถ้า engine ไม่ได้เป็น ESM แต่ attach ไว้ที่ window
  return { mod: null, path: '' };
}

function pickStarterFromWindow() {
  const w = window;

  const cand =
    w.GoodJunkEngine ||
    w.GoodJunkVR ||
    w.GameEngine ||
    (w.GAME_MODULES && (w.GAME_MODULES.GoodJunkEngine || w.GAME_MODULES.GoodJunkVR || w.GAME_MODULES.GameEngine)) ||
    null;

  if (!cand) return null;

  if (typeof cand.boot === 'function') return adaptStarter(cand.boot.bind(cand));
  if (typeof cand.start === 'function') return adaptStarter(cand.start.bind(cand));
  if (cand.GameEngine && typeof cand.GameEngine === 'object') {
    const s = adaptStarter(cand.GameEngine);
    if (s) return s;
  }

  return null;
}

export async function boot(opts = {}) {
  const q = parseQuery(opts.url ? new URL(opts.url) : null);

  const diff = String(opts.diff || q.diff || 'normal').toLowerCase();
  const time = clampInt(opts.time ?? q.time, 20, 180, 60);

  const run = String(opts.run || q.run || '').toLowerCase();
  const challenge = String(opts.challenge || q.challenge || '').toLowerCase();

  const { mod: engineMod, path } = await loadEngineModuleAuto();
  let startEngine = pickEngineStarter(engineMod);

  if (!startEngine) {
    startEngine = pickStarterFromWindow();
  }

  if (!startEngine) {
    console.error('[GoodJunkVR] ❌ ไม่พบ Engine starter (ลองแล้วทั้ง ESM candidates + window fallback)');
    console.error('[GoodJunkVR] ตรวจสอบชื่อไฟล์ engine: game-engine-goodjunk-*.js ว่าเป็น ESM และ export start/boot ได้');
    return null;
  }

  const factoryBoot = await loadFactoryBoot();

  // ✅ ถ้ามี mode-factory ให้ใช้ (รองรับ scroll-follow/ยิงกลางจอ/ฯลฯ)
  if (factoryBoot) {
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

  // ✅ ไม่มี factory ก็สตาร์ทตรง ๆ
  const ctx = { ...opts, diff, time, run, challenge };
  const out = startEngine(ctx);

  if (path) console.log('[GoodJunkVR] engine module:', path);
  return out;
}

export default { boot };