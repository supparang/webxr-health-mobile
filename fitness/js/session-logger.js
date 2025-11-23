// === shadow-breaker.js — bootstrap Shadow Breaker ===
'use strict';

import { initShadowBreaker } from './js/engine.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    initShadowBreaker();
  } catch (e) {
    console.error('ShadowBreaker init failed', e);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้าหรือแจ้งผู้ดูแลระบบ');
  }
});