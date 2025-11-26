// === js/particle.js — DOM hit particle FX (shared) ===
'use strict';

/**
 * spawnHitParticle(host, options)
 *  - host:   element ที่เป็น sandbox ของเอฟเฟ็กต์
 *  - options: { x, y, pos:{x,y}, emoji, count, spread, lifeMs, className }
 */
export function spawnHitParticle(host, options = {}) {
  if (!host) return;

  const {
    x,
    y,
    pos,
    emoji = '✨',
    count = 5,
    spread = 36,
    lifeMs = 480,
    className = ''
  } = options;

  const rect = host.getBoundingClientRect();
  const baseX = (x != null ? x : (pos && pos.x != null ? pos.x : rect.width / 2));
  const baseY = (y != null ? y : (pos && pos.y != null ? pos.y : rect.height / 2));

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'hitParticle';
    if (className) el.classList.add(className);

    const dx = (Math.random() - 0.5) * spread;
    const dy = (Math.random() - 0.5) * spread;

    el.style.left = (baseX + dx) + 'px';
    el.style.top  = (baseY + dy) + 'px';
    el.textContent = emoji;

    host.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, lifeMs);
  }
}

export const Particles = {
  burstHit(host, pos, opts = {}) {
    spawnHitParticle(host, {
      pos,
      emoji: opts.emoji || '✨',
      count: opts.count || 7,
      spread: opts.spread || 40,
      lifeMs: opts.lifeMs || 480,
      className: opts.className || ''
    });
  }
};

// 👇 เพิ่มแค่นี้ เพื่อให้ Rhythm Boxer (script ปกติ) ใช้ได้ด้วย
if (typeof window !== 'undefined') {
  window.Particles = Particles;
}