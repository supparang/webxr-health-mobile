// === fitness/hub.js — VR Fitness Hub Router (4 games, Normal / Research) ===
'use strict';

// กำหนด path ของแต่ละเกม (ตามไฟล์จริงในโฟลเดอร์ fitness)
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
  const m = (mode === 'research') ? 'research' : 'normal';
  const url = `${base}?mode=${encodeURIComponent(m)}`;
  window.location.href = url;
}

window.startGame = startGame;
