// --- Boot OK & hide red bar instantly ---
window.__HHA_BOOT_OK = true;
(function(){
  var w = document.getElementById('bootWarn');
  if (w) {
    // ถ้าเคยโชว์แล้ว ให้แอบทันที
    w.style.display = 'none';
    // (ทางเลือก) แปลงเป็นชิปสีเขียวสั้น ๆ
    // w.textContent = '✅ JS Loaded';
    // w.style.background = '#2e7d32';
    // setTimeout(function(){ w.style.display='none'; }, 1200);
  }
})();
