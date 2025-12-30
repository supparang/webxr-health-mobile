// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — EXTENDED
// ใช้เมื่อคุณมีโมดูลเสริมอื่น ๆ และอยากผูกไว้ที่นี่

'use strict';

import { boot } from './goodjunk.safe.js';

// (optional) ถ้ามีไฟล์เหล่านี้จริง ค่อย uncomment
// import { attachTouchLook } from './touch-look-goodjunk.js';

try {
  // (optional) attachTouchLook?.();
  boot();
} catch (err) {
  console.error('[GoodJunkVR] boot failed:', err);
}