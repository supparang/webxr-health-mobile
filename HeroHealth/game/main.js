// game/main.js  (robust smoke test, ASCII only)
'use strict';

// Let the boot banner know we're good
window.__HHA_BOOT_OK = true;

// Export something so it's a valid ES module
export const hha_ok = true;

// Utility: add chip now (or when DOM is ready)
function addLoadedChip() {
  try {
    if (document.getElementById('hhaLoadedChip')) return;

    var chip = document.createElement('div');
    chip.id = 'hhaLoadedChip';
    chip.textContent = '✅ JS Loaded';
    chip.style.position = 'fixed';
    chip.style.bottom = '12px';
    chip.style.right = '12px';
    chip.style.zIndex = '99999';
    chip.style.padding = '8px 10px';
    chip.style.background = '#16a34a';
    chip.style.color = '#ffffff';
    chip.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    chip.style.fontWeight = '600';
    chip.style.fontSize = '12px';
    chip.style.borderRadius = '8px';
    chip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';

    (document.body || document.documentElement).appendChild(chip);
  } catch (e) {
    // no-op
  }
}

// Try immediate append (if body already exists)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  addLoadedChip();
} else {
  // Fallback to DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    addLoadedChip();
  });
}

// Last-resort timer (in case both above missed)
setTimeout(addLoadedChip, 500);

// Also log to console so you can verify in DevTools
try { console.log('[HHA] game/main.js loaded; hha_ok =', true); } catch (e) {}
