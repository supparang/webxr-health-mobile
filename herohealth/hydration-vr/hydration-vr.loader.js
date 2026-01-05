// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION (PATCHED)
// ✅ Applies view classes + layers mapping
// ✅ Imports ./hydration.safe.js with cache bust
// ✅ Shows readable overlay on failure
// ✅ Exposes window.HHA_VIEW = { view, layers }

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
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

  // map layers for safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    cfg.view = body.classList.contains('view-mobile') ? 'mobile'
            : body.classList.contains('cardboard') ? 'cardboard'
            : body.classList.contains('view-cvr') ? 'cvr'
            : 'pc';

    if (body.classList.contains('cardboard')){
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
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (folder loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">view: <code>${escapeHtml((window.HHA_VIEW && window.HHA_VIEW.view) || '')}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${(tried||[]).map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
        <div style="opacity:.85;margin-top:10px;font-size:12px;line-height:1.35">
          Tip: ถ้าเห็น "Unexpected token &lt;" แปลว่าพาธ import ยิงไปโดน HTML (404) ให้เช็คว่าไฟล์อยู่ในโฟลเดอร์ถูกต้องและชื่อไฟล์ตรง
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

        // ✅ If view is provided in URL, make sure game start event exists (safe.js listens once)
        // (HTML ก็ยิงได้อยู่แล้ว แต่ยิงซ้ำไม่เป็นไรเพราะ safe.js กัน started)
        if (view) {
          try{ window.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
        }
        return;
      }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();