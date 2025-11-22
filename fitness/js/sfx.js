// === sfx.js — Production Ready (2025-11-24) ===
'use strict';

function _play(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(()=>{});
  } catch(e){}
}

export function playHit()   { _play('sfx-hit'); }
export function playBomb()  { _play('sfx-bomb'); }
export function playMiss()  { _play('sfx-miss'); }
export function playFever() { _play('sfx-fever'); }
export function playBoss()  { _play('sfx-boss'); }
