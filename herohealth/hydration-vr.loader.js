// === /herohealth/hydration-vr.loader.js ===
// HydrationVR Safe Loader (NO SAFE CHANGES)
// - Resolve module URL relative to THIS loader script (robust)
// - Show readable overlay if all imports fail

'use strict';

(function () {
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || ''; // cache-bust via v or ts

  function addBust(urlStr) {
    if (!v) return urlStr;
    const u = new URL(urlStr);
    u.searchParams.set('v', v);
    return u.toString();
  }

  // ✅ base = URL ของไฟล์ loader นี้จริง ๆ
  const loaderSrc = (document.currentScript && document.currentScript.src) ? document.currentScript.src : location.href;
  const loaderURL = new URL(loaderSrc);

  function abs(rel) {
    return new URL(rel, loaderURL).toString();
  }

  // โครงสร้างคุณ:
  // /herohealth/hydration-vr.html
  // /herohealth/hydration-vr.loader.js
  // /herohealth/hydration-vr/hydration.safe.js
  const candidates = [
    abs('./hydration-vr/hydration.safe.js'),  // ✅ ใช้จริงกับของคุณ
    abs('./hydration.safe.js'),
    abs('../hydration-vr/hydration.safe.js'),
  ].map(addBust);

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
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">loaderSrc: <code>${escapeHtml(loaderSrc)}</code></div>

        <div style="margin:12px 0 8px 0;font-weight:800">Tried module URLs:</div>
        <ol style="line-height:1.55">${tried.map(s => `<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>

        <div style="margin:12px 0 6px 0;font-weight:800">Last error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    document.body.appendChild(el);
  }

  (async () => {
    const tried = [];
    let lastErr = null;

    for (const u of candidates) {
      tried.push(u);
      try {
        await import(u); // ✅ import absolute URL
        return; // success
      } catch (e) {
        lastErr = e;
      }
    }
    showFail(lastErr || new Error('All candidate imports failed.'), tried);
  })();
})();