// SMOKE TEST main.js
window.__HHA_BOOT_OK = true;
(function(){
  var w = document.getElementById('bootWarn');
  if (w) w.style.display = 'none';
  var chip = document.createElement('div');
  chip.textContent = '✅ JS Loaded (smoke test)';
  chip.style.cssText = 'position:fixed;right:10px;bottom:10px;background:#2e7d32;color:#fff;padding:6px 10px;border-radius:8px;z-index:9999;font:600 12px/1.2 system-ui';
  document.body.appendChild(chip);
})();
export {};
