// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Loader — AUTO DETECT ONLY (NO OVERRIDE)
// ✅ PC / Mobile / cVR auto detect
// ✅ Promote to cVR when fullscreen + landscape on touch device (Cardboard-like)
// ✅ Sets window.HHA_VIEW.layers for hydration.safe.js
// ✅ Robust import error overlay

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const DOC = document;
  const body = DOC.body;

  function isTouch(){
    try{
      return (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
    }catch(_){ return false; }
  }

  function isFullscreenNow(){
    try{ return !!(DOC.fullscreenElement); }catch(_){ return false; }
  }

  function isLandscapeNow(){
    try{
      if (screen.orientation && screen.orientation.type){
        return String(screen.orientation.type).toLowerCase().includes('landscape');
      }
    }catch(_){}
    // fallback
    try{ return window.innerWidth > window.innerHeight; }catch(_){ return false; }
  }

  // AUTO: cVR heuristic
  // - touch device
  // - fullscreen (after user gesture)
  // - landscape (cardboard-like)
  function shouldCVR(){
    return isTouch() && isFullscreenNow() && isLandscapeNow();
  }

  function detectMode(){
    // NOTE: No URL override. Ever.
    if (shouldCVR()) return 'cvr';
    if (isTouch()) return 'mobile';
    return 'pc';
  }

  function applyBodyMode(mode){
    body.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    // We do NOT use split-cardboard in this hydration-vr.html version.
    // If you later make a separate split HTML, that HTML can set body.classList.add('cardboard')
    // by itself before importing hydration.safe.js (still not via URL override).
    if (mode === 'cvr') body.classList.add('view-cvr');
    else if (mode === 'mobile') body.classList.add('view-mobile');
    else body.classList.add('view-pc');
  }

  function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    // Current hydration-vr.html uses single safe layer:
    // <div id="hydration-layer"></div>
    cfg.layers = ['hydration-layer'];
  }

  function refreshMode(){
    try{
      const mode = detectMode();
      applyBodyMode(mode);
      setLayers();
      // optional: announce for debug
      try{
        window.dispatchEvent(new CustomEvent('hha:view', { detail:{ mode } }));
      }catch(_){}
    }catch(_){}
  }

  // Initial
  refreshMode();

  // React to fullscreen/orientation changes (promote mobile -> cVR when enters fullscreen landscape)
  window.addEventListener('fullscreenchange', refreshMode, { passive:true });
  window.addEventListener('orientationchange', ()=>setTimeout(refreshMode, 120), { passive:true });
  window.addEventListener('resize', ()=>setTimeout(refreshMode, 120), { passive:true });

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried){
    const el = DOC.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (auto loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">Detected: <code>${
          escapeHtml(
            body.classList.contains('view-cvr') ? 'cvr' :
            body.classList.contains('view-mobile') ? 'mobile' : 'pc'
          )
        }</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    DOC.body.appendChild(el);
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