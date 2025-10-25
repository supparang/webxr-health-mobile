// game/boot.js
// ตัวบูท: เช็กไฟล์ main.js ก่อน แล้วค่อย import แบบมี error report ชัดเจน

// สถานะบูทเริ่มต้น
window.__HHA_BOOT_OK = 'boot';   // 'boot' | 'main'
window.__HHA_BOOT_ERR = null;

function ensureWarn() {
  let w = document.getElementById('bootWarn');
  if (!w) {
    w = document.createElement('div');
    w.id = 'bootWarn';
    w.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#b00020;color:#fff;padding:10px 12px;font-weight:700;z-index:1000;display:none';
    w.textContent = '⚠️ โหลดสคริปต์ไม่สำเร็จ: ตรวจ path game/main.js หรือ base href';
    document.body.appendChild(w);
  }
  return w;
}

(async function boot(){
  try {
    // สร้าง URL ให้ชัดเจนตาม base ของหน้า
    const mainUrl = new URL('game/main.js', document.baseURI).href;

    // 1) ping ไฟล์ก่อน (กัน 404/สิทธิ์/MIME)
    const res = await fetch(mainUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} @ ${mainUrl}`);
    }

    // 2) import แบบกัน cache
    await import(`${mainUrl}?v=${Date.now()}`);

    // ถ้า main รันสำเร็จ ควรถูกเซ็ตซ้ำใน main.js อยู่แล้ว
    // แต่เซ็ตไว้ที่นี่อีกชั้นเพื่อซ่อน warning
    window.__HHA_BOOT_OK = 'main';

  } catch (err) {
    window.__HHA_BOOT_ERR = err;
    console.error('[HHA boot] Failed to load main.js', err);
    const w = ensureWarn();
    w.textContent = `⚠️ โหลดสคริปต์ไม่สำเร็จ: ${err.message || err}`;
    w.style.display = 'block';
  }
})();
