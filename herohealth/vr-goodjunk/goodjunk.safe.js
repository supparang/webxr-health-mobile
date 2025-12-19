// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — Safe Boot Wrapper
// หน้าที่: อ่าน query (diff/time/run/challenge) + เรียก GameEngine อย่างยืดหยุ่น
// ใช้คู่กับ goodjunk-vr.html (import แล้วเรียก boot)

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

  // challenge/rush/boss/survival (แล้วแต่หน้าเดิมคุณใช้ชื่อพารามิเตอร์อะไร)
  const challenge =
    String(
      url.searchParams.get('challenge') ||
      url.searchParams.get('ch') ||
      url.searchParams.get('mode2') || // เผื่อเคยใช้
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

function pickEngineStarter(engineMod) {
  // รองรับหลายรูปแบบ export เพื่อไม่ล็อคโครงสร้างไฟล์
  if (engineMod) {
    if (typeof engineMod.boot === 'function') return engineMod.boot;
    if (typeof engineMod.start === 'function') return engineMod.start;

    // ถ้า export class GameEngine
    if (typeof engineMod.GameEngine === 'function') {
      return (ctx) => {
        const inst = new engineMod.GameEngine(ctx);
        if (typeof inst.start === 'function') return inst.start();
        if (typeof inst.run === 'function') return inst.run();
        console.error('[GoodJunkVR] GameEngine instance has no start/run');
      };
    }

    // ถ้า export factory makeEngine()
    if (typeof engineMod.makeEngine === 'function') {
      return (ctx) => {
        const inst = engineMod.makeEngine(ctx);
        if (inst && typeof inst.start === 'function') return inst.start();
        console.error('[GoodJunkVR] makeEngine() did not return {start()}');
      };
    }
  }

  // fallback เผื่อเป็น IIFE แล้วผูกไว้ที่ window
  const w = window;
  const cand =
    w.GoodJunkEngine ||
    (w.GAME_MODULES && (w.GAME_MODULES.GoodJunkEngine || w.GAME_MODULES.GoodJunkVR)) ||
    null;

  if (cand) {
    if (typeof cand.boot === 'function') return cand.boot.bind(cand);
    if (typeof cand.start === 'function') return cand.start.bind(cand);
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
    console.error('[GoodJunkVR] ไม่พบตัวเริ่มเกมจาก GameEngine.js (boot/start/GameEngine/makeEngine)');
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
