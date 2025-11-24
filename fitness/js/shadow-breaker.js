// === /fitness/js/shadow-breaker.js — Bootstrap Shadow Breaker (Fixed Path) ===
'use strict';

// ❗ ต้องเป็น ./engine.js เพราะไฟล์นี้อยู่ในโฟลเดอร์เดียวกัน
import { initShadowBreaker } from './engine.js';

function bootShadowBreaker() {
  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] Boot OK');
  } catch (err) {
    console.error('[ShadowBreaker] Boot failed', err);

    // Overlay บอก error
    const box = document.createElement('div');
    box.style.position = 'fixed';
    box.style.left = '50%';
    box.style.top = '20px';
    box.style.transform = 'translateX(-50%)';
    box.style.background = 'rgba(15,23,42,0.96)';
    box.style.color = '#fecaca';
    box.style.padding = '10px 14px';
    box.style.borderRadius = '12px';
    box.style.fontSize = '14px';
    box.style.boxShadow = '0 18px 40px rgba(0,0,0,0.8)';
    box.style.zIndex = '999999';
    box.textContent = '⚠ โหลด Shadow Breaker ไม่สำเร็จ — ตรวจ console log';
    document.body.appendChild(box);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootShadowBreaker);
} else {
  bootShadowBreaker();
}