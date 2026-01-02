// === /herohealth/hydration-vr.loader.js ===
// HydrationVR Safe Loader (FINAL)
// - Try multiple possible import paths (root vs folder)
// - Preflight check (HEAD) to detect 404 / HTML fallback ("Unexpected token <")
// - Show readable overlay if all imports fail

'use strict';

(function () {
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || ''; // cache-bust

  function withBust(p) {
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  // Supports:
  // A) /herohealth/hydration-vr.html -> safe at /herohealth/hydration-vr/hydration.safe.js
  // B) /herohealth/hydration-vr/hydration-vr.html -> safe at /herohealth/hydration-vr/hydration.safe.js
  const candidates = [
    './hydration-vr/hydration.safe.js', // (A) root page
    './hydration.safe.js',              // (B) inside hydration-vr/
    '../hydration-vr/hydration.safe.js' // fallback
  ].map(withBust);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  async function headCheck(url){
    // Returns {ok:boolean, status:number, ct:string, note:string}
    try{
      const res = await fetch(url, { method:'HEAD', cache:'no-store' });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      let note = '';
      if (!res.ok) note = 'NOT_OK';
      else if (ct.includes('text/html')) note = 'HTML_RETURNED';
      else if (!(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('text/plain')))
        note = 'CT_UNUSUAL';
      return { ok: res.ok, status: res.status, ct, note };
    }catch(e){
      return { ok:false, status:0, ct:'', note:'HEAD_FAIL' };
    }
  }

  function showFail(finalErr, triedRows) {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;',
      'font-family:system-ui,Segoe UI,Roboto,Arial;padding:16px;overflow:auto'
    ].join('');

    const rowsHtml = triedRows.map(r=>{
      const badge = r.ok ? '✅' : '❌';
      const meta = `status=${r.status||0} ct=${r.ct||'-'} ${r.note||''}`.trim();
      return `<li style="margin:6px 0">
        <div>${badge} <code>${escapeHtml(r.url)}</code></div>
        <div style="opacity:.85;margin-top:3px;font-size:12px">(${escapeHtml(meta)})</div>
      </li>`;
    }).join('');

    el.innerHTML = `
      <div style="max-width:920px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed</h2>

        <div style="opacity:.95;margin-bottom:10px">
          URL: <code>${escapeHtml(location.href)}</code>
        </div>
        <div style="opacity:.95;margin-bottom:10px">
          baseURI: <code>${escapeHtml(document.baseURI)}</code>
        </div>

        <div style="margin:12px 0 8px 0;font-weight:800">Tried paths (HEAD preflight):</div>
        <ol style="line-height:1.5;padding-left:18px">${rowsHtml}</ol>

        <div style="margin:12px 0 6px 0;font-weight:800">Final error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(finalErr && (finalErr.stack || finalErr.message || finalErr)))}</pre>

        <div style="margin-top:12px;opacity:.95;line-height:1.45">
          ✅ วิธีเช็คเร็ว:
          <ul style="margin:8px 0 0 18px">
            <li>ถ้า <b>status=404</b> = path/case ผิด หรือยังไม่ได้ deploy</li>
            <li>ถ้า <b>ct=text/html</b> = ได้หน้า HTML แทน JS (มักนำไปสู่ <b>Unexpected token '&lt;'</b>)</li>
            <li>ให้ลองเปิด <code>.../hydration.safe.js</code> ในแท็บใหม่ ต้องเห็นไฟล์ JS ไม่ใช่หน้าเว็บ</li>
          </ul>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  (async () => {
    const tried = [];

    for (const p of candidates) {
      // preflight (absolute URL for HEAD)
      const abs = new URL(p, document.baseURI).toString();
      const chk = await headCheck(abs);
      tried.push({ url: abs, ...chk });

      // If clearly missing or HTML returned, still try import (บาง host ตอบ HEAD แปลก)
      try {
        await import(p);
        return; // ✅ success
      } catch (e) {
        // try next
      }
    }

    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();