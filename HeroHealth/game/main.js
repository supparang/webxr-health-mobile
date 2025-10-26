// game/main.js — SMOKE TEST (no imports)
// Goal: clear parser errors, hide red bar, show green chip, and prove <script type="module"> works.

(function () {
  'use strict';

  // Flag for bootloader
  try { window.__HHA_BOOT_OK = true; } catch (e) {}

  // Hide red bar if present
  try {
    var warn = document.getElementById('bootWarn');
    if (warn) warn.style.display = 'none';
  } catch (e) {}

  // Show success chip (bottom-right)
  try {
    var chip = document.createElement('div');
    chip.textContent = '✅ JS Loaded (smoke)';
    chip.style.position = 'fixed';
    chip.style.right = '12px';
    chip.style.bottom = '12px';
    chip.style.background = '#2e7d32';
    chip.style.color = '#fff';
    chip.style.padding = '6px 10px';
    chip.style.borderRadius = '8px';
    chip.style.font = '600 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto';
    chip.style.zIndex = '99999';
    document.body.appendChild(chip);
    setTimeout(function(){ try { chip.remove(); } catch(e){} }, 2000);
  } catch (e) {}

  // Minimal console confirmation
  try { console.info('[HHA] Smoke test OK — main.js parsed & executed.'); } catch (e) {}
})();
