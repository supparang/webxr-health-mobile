// smoke main.js — super minimal to isolate parser/encoding issues
window.__HHA_BOOT_OK = true;

// keep it ES2015-, ASCII only
(function () {
  var c = document.getElementById('c');
  if (c) { c.style.outline = '2px dashed #4caf50'; }

  // simple spawn button to confirm script runs
  var b = document.createElement('button');
  b.type = 'button';
  b.textContent = '✅ JS Loaded';
  b.style.cssText = 'position:fixed;left:20px;top:80px;z-index:999;font-size:18px';
  document.body.appendChild(b);

  console.log('[SMOKE] main.js loaded OK');
})();
