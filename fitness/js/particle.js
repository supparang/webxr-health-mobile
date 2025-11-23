// === js/particle.js — Simple DOM particle for Shadow Breaker (2025-11-24) ===
'use strict';

export function spawnHitParticle(host, x, y, emoji) {
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'hitParticle';
  el.textContent = emoji || '✨';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  host.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 480);
}
