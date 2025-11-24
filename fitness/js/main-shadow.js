// === fitness/js/main-shadow.js — Shadow Breaker wrapper (2025-11-24) ===
'use strict';

// ใช้ engine หลักที่เราทำไว้ ซึ่งมี ShadowBossState + computeShadowSpawnParams อยู่แล้ว
import { initShadowBreaker } from './engine.js';

function getParam(name, def) {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(name) || def;
  } catch {
    return def;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // อ่าน diff/time จาก query string (ถ้าไม่มีใช้ค่าจาก select ในหน้าแทน)
  const diffParam = getParam('diff', null);   // 'easy' | 'normal' | 'hard'
  const timeParam = getParam('time', null);   // เช่น '60'

  // ส่งค่าไปให้ engine ตั้งค่าเริ่มต้น (ถ้าไม่ส่ง engine จะไปอ่านจาก select เอง)
  initShadowBreaker({
    diff: diffParam,           // ถ้า null ให้ engine ใช้ค่า default / จาก <select>
    durationSec: timeParam ? parseInt(timeParam, 10) : null
  });
});
