// === fitness/js/particle.js — emoji explosion (2025-11-24) ===
'use strict';

export function spawnHitParticle(parent, x, y, emoji = '💥') {
  if (!parent) return;
  const el = document.createElement('div');
  el.className = 'hitParticle';
  el.textContent = emoji;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  parent.appendChild(el);

  setTimeout(() => {
    if (el.parentNode === parent) el.remove();
  }, 480);
}
