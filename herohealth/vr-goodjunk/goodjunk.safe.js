// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — Safe Boot Wrapper
// หน้าที่: อ่าน query (diff/time/run/challenge) + เรียก GameEngine อย่างยืดหยุ่น
// ใช้คู่กับ goodjunk-vr.html (import แล้วเรียก boot)
//
// PATCH(PROD):
// ✅ รองรับ engineMod.GameEngine เป็น "object" ที่มี start/stop (ของคุณตอนนี้)
// ✅ รองรับ start(diff, opts) และ start(ctx) (auto-adapt ตาม signature)
// ✅ รองรับ default export ที่เป็น object/function ด้วย

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

  // time: 20–180 (กันค่าหลุด)
  const time = clampInt(url.searchParams.get('time') || '60', 20, 180, 60);

  // run=play/menu (บางหน้าใช้ run=play เพื่อ auto-start)
  const run = String(url.searchParams.get('run') || '').toLowerCase();

  // challenge/rush/boss/survival
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
  // ถ้ามี mode-factory ใช้เลย (เหมือน Hydration/Plate)
  try {
    const mod = await import('../vr/mode-factory.js');
    if (mod && typeof mod.boot === 'function') return mod.boot;
  } catch (_) {}
  return null;
}

async function loadEngineModule() {
  // โหลดเครื่องยนต์ GoodJunk
  try {
    return await import('./GameEngine.js');
  } catch (e) {
    console.warn('[GoodJunkVR] import GameEngine.js failed:', e);
    return null;
  }
}

// ---- Helper: ทำให้ start/boot เรียกได้แบบ "ctx เดียว" เสมอ ----
function adaptStarter(fnOrObj) {
  // คืนฟังก์ชันรูปแบบ: (ctx={}) => any
  if (!fnOrObj) return null;

  // ถ้าเป็น function (เช่น export start หรือ export boot)
  if (typeof fnOrObj === 'function') {
    return (ctx = {}) => {
      // ถ้า signature เป็น start(diff, opts) -> length >= 2
      // แต่ถ้า signature เป็น start(ctx) -> length <= 1
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

  // ถ้าเป็น object ที่มี start (เช่น engineMod.GameEngine = {start,stop})
  if (typeof fnOrObj === 'object' && typeof fnOrObj.start === 'function') {
    return (ctx = {}) => {
      try {
        // object.start อาจเป็น start(diff, opts)
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
  // รองรับหลายรูปแบบ export เพื่อไม่ล็อคโครงสร้างไฟล์
  if (engineMod) {
    // 0) default export (บางไฟล์ export default)
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

    // 3) export const GameEngine = { start, stop }  ✅ (ของคุณตอนนี้)
    if (engineMod.GameEngine && typeof engineMod.GameEngine === 'object') {
      const sObj = adaptStarter(engineMod.GameEngine);
      if (sObj) return sObj;
    }

    // 4) ถ้า export class GameEngine
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

    // 5) ถ้า export factory makeEngine()
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
  }

  // fallback เผื่อเป็น IIFE แล้วผูกไว้ที่ window
  const w = window;
  const cand =
    w.GoodJunkEngine ||
    w.GoodJunkVR ||
    (w.GAME_MODULES && (w.GAME_MODULES.GoodJunkEngine || w.GAME_MODULES.GoodJunkVR)) ||
    null;

  if (cand) {
    // cand.boot หรือ cand.start เป็น function
    if (typeof cand.boot === 'function') return adaptStarter(cand.boot.bind(cand));
    if (typeof cand.start === 'function') return adaptStarter(cand.start.bind(cand));
    // cand.GameEngine เป็น object
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

  // ถ้า opts.run ระบุมา ใช้ก่อน ไม่งั้นใช้จาก query
  const run = String(opts.run || q.run || '').toLowerCase();
  const challenge = String(opts.challenge || q.challenge || '').toLowerCase();

  // 1) โหลด engine
  const engineMod = await loadEngineModule();
  const startEngine = pickEngineStarter(engineMod);

  if (!startEngine) {
    console.error('[GoodJunkVR] ไม่พบตัวเริ่มเกมจาก GameEngine.js (boot/start/GameEngine/makeEngine/default)');
    return;
  }

  // 2) ถ้ามี mode-factory ให้ใช้ (จะได้โครงสร้างร่วมกับเกมอื่น)
  const factoryBoot = await loadFactoryBoot();
  if (factoryBoot) {
    return factoryBoot({
      // ฟิลด์พวกนี้ “ไม่ทำให้พัง” แม้ mode-factory จะ ignore บางอัน
      mode: 'goodjunk',
      projectTag: 'HeroHealth-GoodJunkVR',
      diff,
      time,
      run,
      challenge,

      // สำคัญ: ส่งให้ factory ไปเรียกตอนพร้อมเริ่ม
      engineBoot: (ctx = {}) => startEngine({ ...ctx, diff, time, run, challenge })
    });
  }

  // 3) fallback: ไม่มี mode-factory ก็ start engine ตรง ๆ
  return startEngine({ diff, time, run, challenge });
}

export default { boot };
