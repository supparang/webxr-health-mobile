// === Shadow Breaker entry — shadow-breaker.js (2025-11-20 Production C) ===
import { initShadowBreaker } from './engine.js';

/**
 * ฟังก์ชันบูตเกมหลัก
 * - เรียก initShadowBreaker()
 * - ครอบ try/catch กัน error หลุด ทำให้เห็นใน console ชัด ๆ
 */
function bootShadowBreaker() {
  try {
    initShadowBreaker();
  } catch (err) {
    console.error('Shadow Breaker init failed:', err);
  }
}

/**
 * กันเคสที่ script ถูกโหลดหลัง DOMContentLoaded ไปแล้ว
 * - ถ้า document.readyState ยังเป็น "loading" → รอ DOMContentLoaded ก่อน
 * - ถ้าโหลดเสร็จแล้ว → เรียก bootShadowBreaker() ทันที
 */
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootShadowBreaker, { once: true });
} else {
  bootShadowBreaker();
}