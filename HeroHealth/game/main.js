// === /HeroHealth/game/engine.js ===
// Hero Health – Game Engine (multi-mode + timer + events)
// ใช้ร่วมกับโหมด:
//   - /HeroHealth/modes/goodjunk.safe.js
//   - /HeroHealth/modes/hydration.safe.js
//   - /HeroHealth/modes/plate.safe.js
//   - /HeroHealth/modes/groups.safe.js

'use strict';

import { boot as bootGoodJunk }   from '../modes/goodjunk.safe.js';
import { boot as bootHydration }  from '../modes/hydration.safe.js';
import { boot as bootPlate }      from '../modes/plate.safe.js';
import { boot as bootGroups }     from '../modes/groups.safe.js';

// แผนที่ชื่อโหมด → ฟังก์ชัน boot
const MODE_BOOT = {
  goodjunk : bootGoodJunk,
  hydration: bootHydration,
  plate    : bootPlate,
  groups   : bootGroups
};

// label ที่จะใช้แสดงบน HUD / ปุ่ม "เริ่ม: ..."
export const MODE_LABELS = {
  goodjunk : 'GOOD vs JUNK',
  hydration: 'HYDRATION',
  plate    : 'BALANCED PLATE',
  groups   : 'FOOD GROUPS'
};

// ยิง event แจ้ง UI ว่าตอนนี้เล่นโหมดอะไรอยู่
function emitModeInfo(modeKey, diff, duration) {
  const key = (modeKey || 'goodjunk').toLowerCase();
  const label = MODE_LABELS[key] || 'GOOD vs JUNK';

  try {
    window.dispatchEvent(new CustomEvent('hha:mode', {
      detail: { key, label, difficulty: diff, duration }
    }));
  } catch (e) {
    console.warn('hha:mode event failed', e);
  }
}

/**
 * createGameEngine
 * ใช้ใน main.js:
 *   const engine = await createGameEngine({ mode: MODE, difficulty: DIFF, duration: GAME_DURATION });
 *   engine.start();  // เมื่อกดปุ่มเริ่มเกม
 */
export async function createGameEngine(opts = {}) {
  const modeKey   = (opts.mode || 'goodjunk').toLowerCase();
  const difficulty = (opts.difficulty || 'normal').toLowerCase();
  const duration   = (opts.duration | 0) || 60;

  const boot = MODE_BOOT[modeKey] || MODE_BOOT.goodjunk;

  // controller ของโหมด (ต้องมี start() / stop() ตามที่ safe.js คืนมา)
  const modeCtrl = await boot({
    difficulty,
    duration
  });

  let timeLeft = duration;
  let timerId  = null;
  let running  = false;
  let paused   = false;

  // แจ้ง UI ครั้งแรก
  emitModeInfo(modeKey, difficulty, duration);

  function emitTime() {
    try {
      window.dispatchEvent(new CustomEvent('hha:time', {
        detail: { sec: timeLeft }
      }));
    } catch (e) {
      console.warn('hha:time event failed', e);
    }
  }

  function tick() {
    if (!running || paused) return;
    timeLeft -= 1;
    if (timeLeft < 0) timeLeft = 0;
    emitTime();

    if (timeLeft <= 0) {
      stop(); // หมดเวลา
    }
  }

  function start() {
    if (running) return;
    running = true;
    paused  = false;
    timeLeft = duration;

    emitModeInfo(modeKey, difficulty, duration);
    emitTime(); // ยิง sec เริ่มต้นให้พวก hydration/plate ใช้ onSec

    if (modeCtrl && typeof modeCtrl.start === 'function') {
      modeCtrl.start();
    }

    timerId = setInterval(tick, 1000);
  }

  function pause() {
    if (!running || paused) return;
    paused = true;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    try {
      window.dispatchEvent(new CustomEvent('hha:pause', {
        detail: { paused: true, sec: timeLeft }
      }));
    } catch {}
  }

  function resume() {
    if (!running || !paused) return;
    paused = false;
    emitTime();
    timerId = setInterval(tick, 1000);
    try {
      window.dispatchEvent(new CustomEvent('hha:pause', {
        detail: { paused: false, sec: timeLeft }
      }));
    } catch {}
  }

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    running = false;
    paused  = false;

    if (modeCtrl && typeof modeCtrl.stop === 'function') {
      modeCtrl.stop();
    }
  }

  // เผื่อ main.js อยากดึงค่าไปแสดง
  function getState() {
    return {
      mode      : modeKey,
      difficulty,
      duration,
      timeLeft,
      running,
      paused
    };
  }

  return {
    start,
    pause,
    resume,
    stop,
    getState
  };
}

export default { createGameEngine, MODE_LABELS };