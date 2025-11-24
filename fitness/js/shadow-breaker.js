// === shadow-breaker.js (FIX BOOT) ===
'use strict';

console.log('[SB] loading shadow-breaker.js');

import { initShadowBreaker } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('[SB] DOM ready, booting...');
  try {
    initShadowBreaker();
    console.log('[SB] initShadowBreaker OK');
  } catch (err) {
    console.error('[SB] Boot FAILED:', err);
    alert('Shadow Breaker โหลดไม่สำเร็จ ตรวจ console');
  }
});