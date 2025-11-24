// === js/particle.js — DOM particle FX (2025-11-24, Production Ready v2) ===
'use strict';

export function spawnHitParticle(host, x, y, emoji) {
  if (!host) return;

  const el = document.createElement('div');
  el.className = 'hitParticle';

  // อีโมจิแตกกระจาย
  el.textContent = emoji || '✨';

  // ตำแหน่งกลางเป้า
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  // สุ่มมุมการบินเล็ก ๆ ให้ธรรมชาติขึ้น
  const angle = Math.random() * Math.PI * 2;
  const dist  = 12 + Math.random() * 22; // px
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist;

  // CSS variable ใช้ใน animation
  el.style.setProperty('--dx', dx + 'px');
  el.style.setProperty('--dy', dy + 'px');

  // สุ่ม scale ให้ particle ไม่แข็ง
  const scale = 0.7 + Math.random() * 0.6;
  el.style.transform = `translate(-50%, -50%) scale(${scale})`;

  host.appendChild(el);

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 480);
}