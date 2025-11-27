// === js/main-shadow.js — Shadow Breaker bootstrap (2025-12-02) ===
'use strict';

// ดึงฟังก์ชัน initShadowBreaker จาก engine ใหม่
import { initShadowBreaker } from './engine.js';

// รอให้ DOM โหลดก่อนแล้วค่อยผูก event / เริ่มเกม
function boot() {
  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] initShadowBreaker called from main-shadow.js');
  } catch (err) {
    console.error('[ShadowBreaker] init failed', err);
  }
}

// ใช้ทั้ง DOMContentLoaded และ load เผื่อบาง browser
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
