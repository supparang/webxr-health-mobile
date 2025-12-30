// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (safe)
// - ESM import goodjunk.safe.js แล้ว boot()
// - ถ้า error ให้โชว์ข้อความใน startOverlay ทันที

'use strict';

import { boot } from './goodjunk.safe.js';

try {
  boot();
} catch (err) {
  console.error('[GoodJunkVR] boot() failed:', err);

  try {
    const ov = document.getElementById('startOverlay');
    if (ov) ov.hidden = false;

    const meta = document.getElementById('startMeta');
    if (meta) meta.textContent = 'Boot error: ' + (err && err.message ? err.message : String(err));

    const btn = document.getElementById('btnStart');
    if (btn) btn.textContent = 'รีเฟรช / ตรวจ path ไฟล์';
  } catch (_) {}
}