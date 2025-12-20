// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — Safe Boot Wrapper (PROD)
// ✅ บังคับใช้ GoodJunk GameEngine โดยตรง (NO mode-factory) เพื่อกันเป้าหยดน้ำ/สกินเกมอื่น
// ✅ export boot แบบ named ชัวร์ ๆ ให้ goodjunk-vr.boot.js import ได้

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

async function loadEngineModule() {
  try {
    return await import('./GameEngine.js');
  } catch (e) {
    console.warn('[GoodJunkVR] import ./GameEngine.js failed:', e);
    return null;
  }
}

// ---- Helper: ทำให้ start/boot เรียกได้แบบ "ctx เดียว" เสมอ ----
function adaptStarter(fnOrObj) {
  if (!fnOrObj) return null;

  // function
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

  // object with start
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

  // 0) default export
  if (engineMod.default) {
    const s0 = adaptStarter(engineMod.default);
    if (s0) return s0;

    if (typeof engineMod.default === 'object' && engineMod.default) {
      if (typeof engineMod.default.boot === 'function') return adaptStarter(engineMod.default.boot);
      if (typeof engineMod.default.start === 'function') return adaptStarter(engineMod.default.start);
      if (engineMod.default.GameEngine) {
        const sGE = adaptStarter(engineMod.default.GameEngine);
        if (sGE) return sGE;
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

  // 4) export function createEngine()
  if (typeof engineMod.createEngine === 'function') {
    return (ctx = {}) => {
      const eng = engineMod.createEngine(ctx);
      if (eng && typeof eng.start === 'function') return eng.start(), eng;
      console.error('[GoodJunkVR] createEngine(ctx) did not return {start()}');
      return null;
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

  const engineMod = await loadEngineModule();
  const startEngine = pickEngineStarter(engineMod);

  if (!startEngine) {
    console.error('[GoodJunkVR] ไม่พบตัวเริ่มเกมจาก GameEngine.js (boot/start/GameEngine/createEngine/default)');
    return null;
  }

  // ✅ สำคัญ: GoodJunk ใช้เอนจิ้นเอง ไม่ผ่าน mode-factory (กันเป้าหยดน้ำ/สกินร่วม)
  const layerEl = opts.layerEl || document.getElementById('gj-layer');

  const ctx = {
    ...opts,
    diff,
    time,
    durationSec: time,      // เผื่อ engine ใช้ชื่อ durationSec
    run,
    challenge,
    layerEl
  };

  return startEngine(ctx);
}

export default { boot };