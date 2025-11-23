// js/hub.js — VR Fitness Hub router (4 games, Normal/Research)
'use strict';

const GAME_PATHS = {
  'shadow-breaker': 'shadow-breaker.html',
  'rhythm-boxer'  : 'rhythm-boxer.html',
  'jump-duck'     : 'jump-duck.html',
  'balance-hold'  : 'balance-hold.html'
};

/**
 * startGame(gameKey, mode)
 * gameKey: 'shadow-breaker' | 'rhythm-boxer' | 'jump-duck' | 'balance-hold'
 * mode   : 'normal' | 'research'
 */
export function startGame(gameKey, mode) {
  const base = GAME_PATHS[gameKey];
  if (!base) {
    console.warn('Unknown game key:', gameKey);
    return;
  }

  // แนบ ?mode=... ให้ทุกเกม (ถ้าไฟล์เกมไม่อ่าน param นี้ก็จะถูกละทิ้งเอง)
  const m = (mode === 'research') ? 'research' : 'normal';
  const url = `${base}?mode=${encodeURIComponent(m)}`;
  window.location.href = url;
}

// ให้ใช้ได้จาก inline onclick ใน hub.html
window.startGame = startGame;
