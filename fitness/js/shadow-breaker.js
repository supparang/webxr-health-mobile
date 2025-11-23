// === fitness/js/shadow-breaker.js — bootstrap Shadow Breaker ===
'use strict';

import { initShadowBreaker } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    initShadowBreaker();
  } catch (err) {
    console.error('ShadowBreaker init failed', err);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้าหรือแจ้งผู้ดูแลระบบ');
  }
});