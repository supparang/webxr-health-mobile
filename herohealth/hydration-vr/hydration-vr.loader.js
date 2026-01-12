// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Loader — PRODUCTION (B-compatible, start-after-import)
// ✅ Applies view classes (pc/mobile/cardboard/cvr)
// ✅ Maps layers => window.HHA_VIEW.layers
// ✅ Cache-bust via ?v= (from ts/v)
// ✅ Imports ./hydration.safe.js then dispatches hha:start (reliable)
// ✅ Failure overlay readable

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, d=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; }
  };

  // cache bust token
  const bust = String(qs('v', qs('ts','')) || '').trim();
  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  }

  const view = String(qs('view','') || '').toLowerCase();
  const body = DOC.body;

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // map layers for hydration.safe.js
  (function setLayers(){
    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
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
    const el = DOC.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);' +
      'color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(DOC.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:800">Tried paths:</div>
        <ol style="line-height:1.55">${(tried||[]).map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:800">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
        <div style="opacity:.9;margin-top:10px">
          Tip: เช็ค path ไฟล์ + case-sensitive (GitHub Pages) และดู Network tab ว่า 404 หรือ CORS
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
  }

  function dispatchStart(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  // candidates (เผื่ออนาคตอยาก fallback)
  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{
        await import(p);

        // ✅ start หลัง import สำเร็จ + DOM พร้อม
        if (DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
          setTimeout(dispatchStart, 60);
        } else {
          WIN.addEventListener('DOMContentLoaded', ()=>setTimeout(dispatchStart, 60), { once:true });
        }
        return;
      }catch(_){}
    }

    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();