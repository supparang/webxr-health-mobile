// === js/particle.js — DOM particle FX (2025-11-24, FEVER+BossFace v3) ===
'use strict';

/**
 * spawnHitParticle(host, x, y, emoji, opts)
 *  - host: DOM element ของ field (#target-layer)
 *  - x, y: ตำแหน่งกลางเป้า ภายใน host
 *  - emoji: สัญลักษณ์พื้นฐาน (เช่น '✨', '💥')
 *  - opts: { fever, bossFace, decoy, miss }
 */
export function spawnHitParticle(host, x, y, emoji, opts = {}) {
  if (!host) return;

  const el = document.createElement('div');
  el.className = 'hitParticle';

  // 1) เลือก emoji ตามสถานการณ์
  let sym = emoji || '✨';

  // priority: FEVER > bossFace > decoy > miss > default
  if (opts.fever) {
    // โหมด FEVER: เน้นไฟ / พลัง
    sym = '🔥';
  } else if (opts.bossFace) {
    // ตีโดนหน้าบอส: ใช้มงกุฎหรือเอฟเฟกต์พิเศษ
    sym = '👑';
  } else if (opts.decoy) {
    sym = '💥';
  } else if (opts.miss) {
    sym = '💢';
  }

  el.textContent = sym;

  // 2) ตั้งตำแหน่งเริ่มต้นกลางเป้า
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  // 3) สุ่มทิศทาง / ระยะกระจาย ตามสถานะ
  //    - FEVER: กระเด็นไกลขึ้น
  //    - BossFace: กระเด็นกว้างขึ้นอีกหน่อย
  const baseDist   = 12;
  const feverBoost = opts.fever ? 16 : 0;
  const bossBoost  = opts.bossFace ? 10 : 0;
  const dist       = baseDist + feverBoost + bossBoost + Math.random() * 12;

  const angle = Math.random() * Math.PI * 2;
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist;

  el.style.setProperty('--dx', dx + 'px');
  el.style.setProperty('--dy', dy + 'px');

  // 4) random scale (FEVER ใหญ่ขึ้นนิดหน่อย)
  const baseScale   = 0.8 + Math.random() * 0.4;
  const scaleBoost  = opts.fever ? 0.25 : 0;
  const finalScale  = baseScale + scaleBoost;
  el.style.transform = `translate(-50%, -50%) scale(${finalScale})`;

  host.appendChild(el);

  // 5) เคลียร์ออกตามเวลา animation (.48s ใน CSS)
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 500);
}