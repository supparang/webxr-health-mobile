// === js/particle.js — DOM hit particle FX (Rhythm Boxer / Shadow Breaker) (2025-11-30) ===
(function () {
  'use strict';

  /**
   * spawnHitParticle(host, options)
   *  - host:   element ที่เป็น sandbox ของ effect (เช่น #rb-field หรือ #target-layer)
   *  - options:
   *      x, y      : ตำแหน่งภายใน host (px) ตรงกลางเอฟเฟกต์
   *      emoji     : อีโมจิที่ใช้เป็นเศษ particle (เช่น '✨', '💥', '⭐')
   *      count     : จำนวนชิ้น (default 8)
   *      spread    : ระยะกระจายรอบ ๆ จุดกลาง (px) (default 60)
   *      lifeMs    : เวลาแสดงผล (default 550 ms)
   *      className : เพิ่มคลาสเสริม เช่น 'rb-hit-particle'
   */
  function spawnHitParticle(host, options) {
    if (!host) return;
    options = options || {};

    const emoji    = options.emoji || '✨';
    const count    = options.count != null ? options.count : 8;
    const spread   = options.spread != null ? options.spread : 60;
    const lifeMs   = options.lifeMs != null ? options.lifeMs : 550;
    const className = options.className || '';

    const rect = host.getBoundingClientRect();
    const baseX = options.x != null ? options.x : rect.width / 2;
    const baseY = options.y != null ? options.y : rect.height / 2;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.textContent = emoji;
      el.style.position = 'absolute';
      el.style.left = baseX + 'px';
      el.style.top  = baseY + 'px';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.fontSize = (options.size || 20) + 'px';
      el.style.pointerEvents = 'none';
      el.style.opacity = '1';
      el.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
      el.style.zIndex = 20;
      el.className = className || 'hitParticle';

      host.appendChild(el);

      const dx = (Math.random() - 0.5) * spread;
      const dy = (Math.random() - 0.5) * spread;

      // animate ออกไปด้านนอกแล้วค่อย ๆ หาย
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(0.7)`;
        el.style.opacity = '0';
      });

      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, lifeMs);
    }
  }

  const Particles = {
    burstHit(host, pos, opts) {
      opts = opts || {};
      spawnHitParticle(host, {
        x: pos && pos.x,
        y: pos && pos.y,
        emoji: opts.emoji || '✨',
        count: opts.count || 10,
        spread: opts.spread || 72,
        lifeMs: opts.lifeMs || 550,
        className: opts.className || 'hitParticle'
      });
    }
  };

  // ผูกเข้า global ให้ Rhythm / Shadow เรียกใช้ได้
  if (typeof window !== 'undefined') {
    window.spawnHitParticle = spawnHitParticle;
    window.RbParticles = Particles;
    // ถ้าไม่มี Particles ทั่วไปอยู่แล้ว ค่อยผูกให้ (กันชนกับของเกมอื่น)
    if (!window.Particles) {
      window.Particles = Particles;
    }
  }
})();
