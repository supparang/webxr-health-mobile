// === /herohealth/hydration-vr.loader.js ===
// HydrationVR Safe Loader (NO SAFE CHANGES)
// - Apply view classes (pc/mobile/cardboard)
// - Cardboard best-effort fullscreen + landscape lock
// - Try multiple import paths (root vs folder)
// - Show readable overlay if all imports fail

'use strict';

(function () {
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || ''; // cache-bust via v or ts
  const view = String(q.get('view') || '').toLowerCase();

  function withBust(p) {
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  // -------------------- Apply View --------------------
  (function applyView(){
    const b = document.body;

    b.classList.remove('view-pc','view-mobile','view-vr','cardboard');

    if (view === 'cardboard' || view === 'vr'){
      b.classList.add('view-vr','cardboard');

      // Provide layers hint for hydration.safe.js (split L/R)
      try{
        window.HHA_VIEW = window.HHA_VIEW || {};
        window.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
      }catch(_){}

      // best-effort fullscreen (may require gesture; still ok)
      setTimeout(()=>{
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        try{ req && req.call(el); }catch(_){}
      }, 220);

      // best-effort landscape lock
      setTimeout(async ()=>{
        try{
          if (screen.orientation && screen.orientation.lock){
            await screen.orientation.lock('landscape');
          }
        }catch(_){}
      }, 380);

    } else if (view === 'mobile'){
      b.classList.add('view-mobile');
    } else {
      b.classList.add('view-pc');
    }
  })();

  // ✅ รองรับทั้ง 2 โครงสร้าง:
  // A) /herohealth/hydration-vr.html                 -> safe อยู่ /herohealth/hydration-vr/hydration.safe.js
  // B) /herohealth/hydration-vr/hydration-vr.html    -> safe อยู่โฟลเดอร์เดียวกัน /herohealth/hydration-vr/hydration.safe.js
  const candidates = [
    './hydration-vr/hydration.safe.js',  // (A) root page
    './hydration.safe.js',               // (B) if page is inside hydration-vr/
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
        <div style="opacity:.9;margin-bottom:10px">view: <code>${escapeHtml(view||'(none)')}</code></div>

        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s => `<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>

        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>

        <div style="margin-top:12px;opacity:.9">
          ✅ ทดสอบเร็ว: เปิดลิงก์ใน "Tried paths" ทีละอัน ถ้าเห็น 404 = path/case ผิด หรือยังไม่ได้ deploy
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  (async () => {
    const tried = [];
    for (const p of candidates) {
      tried.push(p);
      try {
        await import(p);
        return; // success
      } catch (e) {
        // try next
      }
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();