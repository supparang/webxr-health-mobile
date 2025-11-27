// === js/shadow-breaker.js — Shadow Breaker bootstrap (2025-11-28b) ===
'use strict';

import { initShadowBreaker } from './engine.js';

function bootShadowBreaker() {
  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] bootstrap OK');
  } catch (e) {
    console.error('ShadowBreaker init failed', e);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า');
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootShadowBreaker);
} else {
  bootShadowBreaker();
}