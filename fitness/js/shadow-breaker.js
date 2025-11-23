// === js/shadow-breaker.js — Shadow Breaker bootstrap (2025-11-24 FULL) ===
'use strict';

// engine.js ต้องมี:
//   export function initShadowBreaker()
//   export function startGame()
// (ฉบับที่แก้ให้ตรงชื่อ startGame แล้ว)

import { startGame } from './engine.js';

function applyUrlPreset() {
  try {
    const params = new URLSearchParams(window.location.search);
    const diff = params.get('diff');
    if (!diff) return;

    const diffSel = document.getElementById('difficulty');
    if (!diffSel) return;

    if (['easy','normal','hard'].includes(diff)) {
      diffSel.value = diff;
    }
  } catch (e) {
    console.warn('ShadowBreaker: URL preset parse failed', e);
  }
}

// เมื่อโหลด DOM เสร็จ → apply preset → startGame()
window.addEventListener('DOMContentLoaded', () => {
  applyUrlPreset();
  startGame();   // ← เรียก engine.js (หลังแก้ exports แล้วจะไม่ error)
});
