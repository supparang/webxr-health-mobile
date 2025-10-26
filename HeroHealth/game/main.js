// game/main.js  (ASCII-only smoke test)
// Purpose: prove module loads; shows a green "JS Loaded" chip.

'use strict';

// Tell index boot banner we're alive
window.__HHA_BOOT_OK = true;

// Minimal no-op to ensure ESM is valid
export const hha_ok = true;

// Add a small success badge on screen so we know this file executed
(function () {
  var chip = document.createElement('div');
  chip.id = 'hhaLoadedChip';
  chip.textContent = '✅ JS Loaded';
  chip.style.position = 'fixed';
  chip.style.bottom = '12px';
  chip.style.right = '12px';
  chip.style.zIndex = '9999';
  chip.style.padding = '8px 10px';
  chip.style.background = '#16a34a';
  chip.style.color = '#fff';
  chip.style.font = '600 12px/1.2 system-ui, -apple-system, Segoe UI, Arial';
  chip.style.borderRadius = '8px';
  chip.style.boxShadow = '0 2px 8px rgba(0,0,0,.25)';
  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(chip);
  });
})();
