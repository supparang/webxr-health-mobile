// === /herohealth/hydration-vr.loader.js ===
// HydrationVR Safe Loader (NO SAFE CHANGES)
// - Try multiple possible paths (root vs folder)
// - Show a readable overlay if all imports fail

'use strict';

(function () {
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || ''; // cache-bust

  function withBust(p) {
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  // A) /herohealth/hydration-vr.html               -> safe: /herohealth/hydration-vr/hydration.safe.js
  // B) /herohealth/hydration-vr/hydration-vr.html  -> safe: /herohealth/hydration-vr/hydration.safe.js (same folder)
  const candidates = [
    './hydration-vr/hydration.safe.js',  // from /herohealth/hydration-vr.html
    './hydration.safe.js',               // from /herohealth/hydration-vr/hydration-vr.html
    '../hydration-vr/hydration.safe.js', // fallback
  ].map(withBust);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried) {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;',
      'font-family:system-ui,Segoe UI,Roboto,Arial;padding:16px;overflow:auto'
    ].join('');
    el.innerHTML = `
      <div style="max-width:880px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s => `<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
        <div style="margin-top:12px;opacity:.9">
          ✅ ทดสอบเร็ว: เปิด "Tried paths" ทีละอัน ถ้า 404 = path/case ผิด หรือยังไม่ deploy
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  (async () => {
    const tried = [];
    let lastErr = null;

    for (const p of candidates) {
      tried.push(p);
      try {
        await import(p);
        // ✅ success — ไม่ต้องทำอะไรเพิ่ม
        // เริ่มเกมจะมาจาก (1) ปุ่ม START หรือ (2) auto-hide overlay เมื่อ run=play
        return;
      } catch (e) {
        lastErr = e;
      }
    }

    showFail(lastErr || new Error('All candidate imports failed.'), tried);
  })();
})();