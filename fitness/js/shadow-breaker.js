// === js/shadow-breaker.js — bootstrap Shadow Breaker (FIXED PATH) ===
'use strict';

import { initShadowBreaker } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] init OK');
  } catch (e) {
    console.error('[ShadowBreaker] init failed', e);
    alert('ไม่สามารถเริ่มเกมได้ กรุณารีเฟรชหน้า');
  }
});