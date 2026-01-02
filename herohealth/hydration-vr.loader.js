// === /herohealth/hydration-vr.loader.js ===
// HydrationVR Root Loader (SAFE: no gameplay changes)
// - Supports /herohealth/hydration-vr.html -> safe at /herohealth/hydration-vr/hydration.safe.js
// - Shows readable overlay if import fails

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const candidates = [
    './hydration-vr/hydration.safe.js',
  ].map(withBust);

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
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (root loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    document.body.appendChild(el);
  }

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{ await import(p); return; }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();