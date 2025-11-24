// === js/shadow-breaker.js — Bootstrap Shadow Breaker (2025-11-24 v2) ===
'use strict';

import { initShadowBreaker } from './engine.js';

function showFatalMessage(msg) {
  try {
    const box = document.createElement('div');
    box.style.position      = 'fixed';
    box.style.left          = '50%';
    box.style.top           = '16px';
    box.style.transform     = 'translateX(-50%)';
    box.style.zIndex        = '9999';
    box.style.background    = 'rgba(15,23,42,0.96)';
    box.style.color         = '#fecaca';
    box.style.padding       = '10px 14px';
    box.style.borderRadius  = '12px';
    box.style.fontSize      = '13px';
    box.style.fontFamily    =
      'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    box.style.boxShadow     = '0 18px 40px rgba(0,0,0,0.8)';
    box.textContent         = msg;
    document.body.appendChild(box);
  } catch (e) {
    // ถ้า DOM ยังใช้ไม่ได้ก็เฉย ๆ ไป
  }
}

function boot() {
  // กันไม่ให้ init ซ้ำเวลามี script ซ้อนกัน
  if (window.__shadowBreakerBooted) {
    console.log('[ShadowBreaker] Already booted, skip.');
    return;
  }

  try {
    initShadowBreaker();
    window.__shadowBreakerBooted = true;
    console.log('[ShadowBreaker] Boot OK');
  } catch (err) {
    console.error('[ShadowBreaker] Boot failed', err);
    showFatalMessage(
      'เกิดข้อผิดพลาดในการโหลดเกม Shadow Breaker กรุณาดู console log หรือรีเฟรชหน้าเว็บอีกครั้ง'
    );
  }
}

// รอให้ DOM พร้อมก่อน
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}