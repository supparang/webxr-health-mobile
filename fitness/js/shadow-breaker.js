// === js/shadow-breaker.js — Shadow Breaker bootstrap (2025-12-03, stable) ===
'use strict';

import { initShadowBreaker } from './engine.js';

function bootShadowBreaker() {
  // กันกรณีโหลดไฟล์ JS แต่ engine.js เปลี่ยนชื่อ / ยังไม่พร้อม
  if (typeof initShadowBreaker !== 'function') {
    console.error('[ShadowBreaker] initShadowBreaker is not a function');
    return;
  }

  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] bootstrap OK (initShadowBreaker called)');
  } catch (e) {
    console.error('[ShadowBreaker] init failed', e);
    // ถ้าเป็น production จริง ๆ จะตัด alert ทิ้งก็ได้
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า');
  }
}

// ให้เรียกแค่ครั้งเดียวตอน DOM พร้อมแล้ว
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootShadowBreaker, { once: true });
} else {
  bootShadowBreaker();
}