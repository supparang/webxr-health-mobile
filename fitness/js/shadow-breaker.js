// === js/shadow-breaker.js — Shadow Breaker bootstrap (2025-11-27c) ===
'use strict';

import { initShadowBreaker } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    // ให้ engine.js จัดการทุกอย่าง:
    // - สร้าง ShadowBreakerEngine
    // - ผูกปุ่มเมนู (start, research, stop, back-to-menu, play-again)
    // - ใช้ DomRenderer / EventLogger / SessionLogger
    // - อัปเดต HUD และหน้า RESULT + CSV
    initShadowBreaker();
    console.log('[ShadowBreaker] bootstrap OK');
  } catch (e) {
    console.error('ShadowBreaker init failed', e);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า');
  }
});
