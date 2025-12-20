// === /herohealth/vr-goodjunk/GameEngine.js ===
// ES Module adapter (PRODUCTION)
// หน้าที่: โหลด GameEngine.legacy.js แล้ว export ตัวเริ่มเกมให้ goodjunk.safe.js หาเจอ

'use strict';

// โหลด legacy ให้แน่ใจว่ามี window.xxx ถูกผูกก่อน
import './GameEngine.legacy.js';

function pickGlobalEngine() {
  const w = window;

  // ปรับรายชื่อ candidate ให้ตรงกับที่ legacy ของคุณผูกไว้จริง
  return (
    w.GoodJunkEngine ||
    w.GoodJunkVR ||
    w.GameEngine || // เผื่อคุณผูกชื่อแบบนี้
    (w.GAME_MODULES && (w.GAME_MODULES.GoodJunkEngine || w.GAME_MODULES.GoodJunkVR || w.GAME_MODULES.GameEngine)) ||
    null
  );
}

export const GameEngine = {
  start(ctx = {}) {
    const eng = pickGlobalEngine();
    if (!eng) {
      console.error('[GoodJunkVR] legacy engine not found on window/GAME_MODULES');
      return null;
    }

    // รองรับหลายรูปแบบ
    if (typeof eng.start === 'function') return eng.start(ctx);
    if (typeof eng.boot === 'function')  return eng.boot(ctx);

    // บางคนผูกเป็น object.GameEngine
    if (eng.GameEngine && typeof eng.GameEngine.start === 'function') return eng.GameEngine.start(ctx);

    console.error('[GoodJunkVR] legacy engine has no start/boot');
    return null;
  },

  stop() {
    const eng = pickGlobalEngine();
    try {
      if (eng && typeof eng.stop === 'function') return eng.stop();
      if (eng && typeof eng.destroy === 'function') return eng.destroy();
      if (eng && typeof eng.GameEngine?.stop === 'function') return eng.GameEngine.stop();
    } catch (e) {
      console.warn('[GoodJunkVR] stop failed:', e);
    }
    return null;
  }
};

export default { GameEngine };
