// js/shadow-breaker.js
'use strict';
import { initShadowBreaker } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    initShadowBreaker();   // จะผูกปุ่ม "เริ่มเล่นเลย" ให้อัตโนมัติ
  } catch (e) {
    console.error('ShadowBreaker init failed', e);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า');
  }
});
