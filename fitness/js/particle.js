// === js/particle.js — Simple emoji hit particle (2025-11-24) ===
'use strict';

/**
 * spawnHitParticle(host, x, y, emoji)
 *  - host  : element ของ playfield (เช่น .sb-field)
 *  - x, y  : ตำแหน่งภายใน host (พิกัด px)
 *  - emoji : ตัวอีโมจิที่จะแสดง เช่น '✨', '💥', '💢'
 */
export function spawnHitParticle(host, x, y, emoji) {
  if (!host) return;

  const el = document.createElement('div');
  el.className = 'hitParticle';
  el.textContent = emoji || '✨';

  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  host.appendChild(el);

  // ให้แอนิเมชันใน CSS เล่นจบแล้วลบออก
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 480);
}