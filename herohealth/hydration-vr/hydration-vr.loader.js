// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — AUTO-DETECT FRIENDLY (NO OVERRIDE)
// ✅ Uses body classes set by ../vr/view-auto.js
// ✅ Maps window.HHA_VIEW.layers for safe.js (single vs cardboard split)
// ✅ Imports ./hydration.safe.js (cache bust via ?v or ?ts)
// ✅ Shows readable overlay on failure

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const body = document.body;

  // IMPORTANT: view-auto.js owns the view classes.
  // Do NOT add/remove view classes here. No override.

  // map layers for hydration.safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    const isCardboard = body.classList.contains('cardboard');

    if (isCardboard){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried){
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed','inset:0','z-index:99999',
      'background:rgba(2,6,23,.92)','color:#e5e7eb',
      'font-family:system-ui','padding:16px','overflow:auto'
    ].join(';');

    const viewClass = [
      body.classList.contains('view-pc') ? 'view-pc' : '',
      body.classList.contains('view-mobile') ? 'view-mobile' : '',
      body.classList.contains('view-cvr') ? 'view-cvr' : '',
      body.classList.contains('cardboard') ? 'cardboard' : ''
    ].filter(Boolean).join(' ');

    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (folder loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">
          View (from auto-detect): <code>${escapeHtml(viewClass||'(none)')}</code>
        </div>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>

        <div style="margin-top:12px;opacity:.95">
          <div style="font-weight:700;margin-bottom:6px">Quick checks:</div>
          <ul style="line-height:1.5;margin:0;padding-left:18px">
            <li>เปิดผ่าน <code>https://</code> (GitHub Pages) ไม่ใช่ file://</li>
            <li>ไฟล์ <code>hydration.safe.js</code> อยู่ในโฟลเดอร์เดียวกับ loader จริง</li>
            <li>พาธ import ของ safe.js ไป <code>../vr/ui-water.js</code> และ <code>../vr/ai-coach.js</code> ถูกต้อง</li>
            <li>ถ้าเจอ CORS/404 ให้ดู DevTools → Network</li>
          </ul>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{
        await import(p);
        return;
      }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();