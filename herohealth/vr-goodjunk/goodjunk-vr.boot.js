// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (safe)
// - ESM import goodjunk.safe.js แล้ว boot()
// - fallback แจ้ง error ชัด ๆ ถ้า path/serve มีปัญหา

'use strict';

import { boot } from './goodjunk.safe.js';

try {
  boot();
} catch (err) {
  console.error('[GoodJunkVR] boot() failed:', err);
  try {
    const el = document.getElementById('startOverlay');
    if (el) {
      el.hidden = false;
      const meta = document.getElementById('startMeta');
      if (meta) meta.textContent = 'Boot error: ' + (err && err.message ? err.message : String(err));
      const btn = document.getElementById('btnStart');
      if (btn) btn.textContent = 'รีเฟรช / ตรวจไฟล์';
    }
  } catch (_) {}
}