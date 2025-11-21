// === js/particle.js — simple emoji particle (2025-11-22) ===
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
    if (el.parentNode === parent) parent.removeChild(el);
  }, 480);
}