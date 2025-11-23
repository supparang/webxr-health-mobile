// === js/shadow-breaker.js — Shadow Breaker bootstrap (2025-11-24) === 
'use strict';

import { initShadowBreaker } from './engine.js';

function applyUrlPreset() {
  try {
    const params = new URLSearchParams(window.location.search);
    const diff = params.get('diff');

    const diffSel = document.getElementById('difficulty');
    if (diffSel && diff && ['easy','normal','hard'].includes(diff)) {
      diffSel.value = diff;
    }
  } catch (e) {
    console.warn('ShadowBreaker: URL preset parse failed', e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // ตั้งค่า diff จาก URL (ถ้ามี) ก่อนสร้างเกม
  applyUrlPreset();

  // สร้างเกม + wire ปุ่มทั้งหมด
  initShadowBreaker();
});
