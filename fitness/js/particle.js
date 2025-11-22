// === js/particle.js — Simple Emoji Particle (2025-11-24 Research Edition) ===
'use strict';

/**
 * spawnHitParticle(parent, x, y, emoji = '💥')
 * - parent: element ภายในซีน (เช่น #target-layer หรือ #sb-wrap)
 * - x,y   : ตำแหน่งภายใน parent (พิกัด local)
 * - emoji : อีโมจิสำหรับเอฟเฟกต์ เช่น ⭐ 💥 ✨
 */
export function spawnHitParticle(parent, x, y, emoji = '💥') {
  if (!parent) return;

  const el = document.createElement('div');
  el.className = 'hitParticle';
  el.textContent = emoji;

  // ตำแหน่งกลาง particle ให้ตรงเป้า
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  parent.appendChild(el);

  // เอาออกหลังแอนิเมชันจบ
  setTimeout(() => {
    if (el.parentNode === parent) {
      parent.removeChild(el);
    }
  }, 480);
}
