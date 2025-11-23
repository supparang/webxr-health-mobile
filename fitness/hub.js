// === fitness/hub.js — VR Fitness Hub Router (4 games, Normal / Research) ===
'use strict';

// กำหนด path ของแต่ละเกม (ตามไฟล์ที่อาจารย์มีอยู่จริง)
const GAME_PATHS = {
  'shadow-breaker': 'shadow-breaker.html',
  'rhythm-boxer'  : 'rhythm-boxer.html',
  'jump-duck'     : 'jump-duck.html',
  'balance-hold'  : 'balance-hold.html'
};

/**
 * startGame(gameKey, mode)
 *  gameKey: 'shadow-breaker' | 'rhythm-boxer' | 'jump-duck' | 'balance-hold'
 *  mode   : 'normal' | 'research'
 */
function startGame(gameKey, mode) {
  const base = GAME_PATHS[gameKey];
  if (!base) {
    console.warn('Unknown game key:', gameKey);
    return;
  }

  // ถ้าเกมรองรับโหมดวิจัย ให้ส่ง ?mode=research ไปให้
  const m = (mode === 'research') ? 'research' : 'normal';

  // ถ้าอยากแนบระดับความยากเพิ่ม สามารถแก้ต่อได้ เช่น diff=normal
  const url = `${base}?mode=${encodeURIComponent(m)}`;

  window.location.href = url;
}

// ให้เรียกใช้ได้จาก inline onclick ใน hub.html
window.startGame = startGame;
