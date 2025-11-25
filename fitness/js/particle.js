// === js/particle.js — DOM hit particle FX (VR Fitness / Shadow Breaker) ===
'use strict';

/**
 * spawnHitParticle(host, options)
 *  - host:   element ที่เป็น sandbox ของเอฟเฟ็กต์ (เช่น #target-layer หรือ .sb-field)
 *  - options:
 *      x, y      : ตำแหน่งจอ (px) ตรงกลางของเอฟเฟ็กต์
 *      pos       : {x, y} ใช้แทน x,y ได้
 *      emoji     : อีโมจิที่ใช้เป็นเศษ particle (เช่น '✨', '💥', '⭐')
 *      count     : จำนวนชิ้น (default 5)
 *      spread    : ระยะกระจายรอบ ๆ จุดกลาง (px) (default 36)
 *      lifeMs    : เวลาแสดงผล ก่อนถอด DOM (default 480 ms)
 *      className : เพิ่มคลาสเสริม เช่น 'sb-hit-particle'
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

    // random offset รอบจุดกลาง
    const dx = (Math.random() - 0.5) * spread;
    const dy = (Math.random() - 0.5) * spread;

    el.style.left = (baseX + dx) + 'px';
    el.style.top  = (baseY + dy) + 'px';
    el.textContent = emoji;

    host.appendChild(el);

    // cleanup ตามอายุอนิเมชัน
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, lifeMs);
  }
}

/**
 * Utility object เผื่ออนาคตอยากเรียกแบบ Particles.burst(...)
 * แต่ตอนนี้ Shadow Breaker ใช้ spawnHitParticle โดยตรง
 */
export const Particles = {
  /**
   * burstHit(host, pos, opts)
   *  - pos: {x, y}
   */
  burstHit(host, pos, opts = {}) {
    spawnHitParticle(host, {
      pos,
      emoji: opts.emoji || '✨',
      count: opts.count || 5,
      spread: opts.spread || 40,
      lifeMs: opts.lifeMs || 480,
      className: opts.className || ''
    });
  }
};