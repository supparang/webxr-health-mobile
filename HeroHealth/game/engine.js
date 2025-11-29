// === /HeroHealth/game/engine.js (2025-11-29)
// หน้าที่: เลือกโหมด + boot โหมดให้ถูกต้องเท่านั้น
// ไม่คุม timer / spawn เอง ปล่อยให้แต่ละโหมดจัดการเอง

'use strict';

// ----- นำเข้าโหมดต่าง ๆ -----
import { boot as bootGoodJunk }   from '../modes/goodjunk.safe.js';
import { boot as bootGroups }     from '../modes/groups.safe.js';
import { boot as bootHydration }  from '../modes/hydration.safe.js';
import { boot as bootPlate }      from '../modes/plate.safe.js';

// map โหมด → ฟังก์ชัน boot
const MODE_BOOT = {
  goodjunk : bootGoodJunk,
  groups   : bootGroups,
  hydration: bootHydration,
  plate    : bootPlate,
};

// label สำหรับ HUD / ปุ่มเริ่ม
export const MODE_LABELS = {
  goodjunk : 'เลือกอาหารดี เลี่ยงขยะ',
  groups   : 'เก็บอาหารให้ครบหมู่เป้าหมาย',
  hydration: 'ดื่มน้ำให้สมดุลทั้งวัน',
  plate    : 'จัดจาน 5 หมู่ให้สวยสมดุล',
};

// helper เลือก key ให้ปลอดภัย
function normalizeMode(mode) {
  const m = (mode || 'goodjunk').toLowerCase();
  if (MODE_BOOT[m]) return m;
  return 'goodjunk';
}

/**
 * createGameEngine({ mode, difficulty, duration })
 * main.js จะเรียกฟังก์ชันนี้ แล้วได้ controller ที่มี start/pause/resume/stop
 */
export async function createGameEngine(opts = {}) {
  const mode = normalizeMode(opts.mode);
  const difficulty = (opts.difficulty || 'normal').toLowerCase();
  const duration   = (opts.duration | 0) || 60;

  const bootFn = MODE_BOOT[mode] || MODE_BOOT.goodjunk;

  // เรียก boot ของโหมดนั้น (แต่ละโหมดจะจัดการ spawn + hha:time เอง)
  const ctrl = await bootFn({
    difficulty,
    duration,
  });

  // แจ้ง HUD ว่าโหมดอะไร (ไว้ใช้แสดงชื่อ / คำอธิบาย)
  try {
    window.dispatchEvent(new CustomEvent('hha:mode', {
      detail: {
        mode,
        label: MODE_LABELS[mode] || mode,
        difficulty,
        duration,
      },
    }));
  } catch (e) {
    console.warn('hha:mode event error', e);
  }

  // safety wrapper – เผื่อบางโหมดไม่มี pause/resume
  return {
    start()  { if (ctrl && typeof ctrl.start  === 'function') ctrl.start(); },
    pause()  { if (ctrl && typeof ctrl.pause  === 'function') ctrl.pause(); },
    resume() { if (ctrl && typeof ctrl.resume === 'function') ctrl.resume(); },
    stop()   { if (ctrl && typeof ctrl.stop   === 'function') ctrl.stop(); },
    // เผื่อ main.js อยากอ่านของเดิม
    mode,
    difficulty,
    duration,
  };
}

// optional: default export เผื่อ main.js เคย import default
export default { createGameEngine, MODE_LABELS };