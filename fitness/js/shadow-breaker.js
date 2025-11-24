// === js/shadow-breaker.js — bootstrap Shadow Breaker (fixed path) ===
'use strict';

import { initShadowBreaker } from './engine.js';

function boot() {
  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] Boot OK');
  } catch (e) {
    console.error('[ShadowBreaker] Boot failed', e);
    const box = document.createElement('div');
    box.style.position = 'fixed';
    box.style.left = '50%';
    box.style.top = '16px';
    box.style.transform = 'translateX(-50%)';
    box.style.background = 'rgba(15,23,42,0.96)';
    box.style.color = '#fecaca';
    box.style.padding = '10px 14px';
    box.style.borderRadius = '12px';
    box.style.fontSize = '13px';
    box.style.boxShadow = '0 18px 40px rgba(0,0,0,0.8)';
    box.textContent = 'เกิดข้อผิดพลาดในการโหลดเกม Shadow Breaker ดู console log';
    document.body.appendChild(box);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}