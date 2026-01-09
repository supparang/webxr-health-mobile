// === /herohealth/plate/plate-vr.loader.js ===
// PlateVR Folder Loader — PRODUCTION
// ✅ Applies view classes
// ✅ Maps layers for safe.js via window.HHA_VIEW.layers
// ✅ Imports ./plate.safe.js (cache-bust aware)
// ✅ Shows readable overlay on failure

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const view = String(q.get('view') || '').toLowerCase();
  const body = document.body;

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // map layers for safe.js (DOM engine)
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      // standard split layers
      cfg.layers = ['plate-layerL','plate-layerR'];
    } else {
      cfg.layers = ['plate-layer'];
    }
  })();

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried){
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ PlateVR: import failed (folder loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
        <div style="margin-top:10px;opacity:.9">
          Tips:
          <ul>
            <li>เช็ก path ว่าอยู่ที่ <code>/herohealth/plate/plate.safe.js</code> จริง</li>
            <li>ถ้าเปิดจาก GitHub Pages ต้องแน่ใจว่าใช้ relative path ถูกโฟลเดอร์</li>
            <li>ลองใส่ <code>?ts=${Date.now()}</code> เพื่อบังคับโหลดใหม่</li>
          </ul>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [
    './plate.safe.js',
  ].map(withBust);

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{ await import(p); return; }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();