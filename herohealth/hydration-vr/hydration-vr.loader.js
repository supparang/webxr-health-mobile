// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Loader — AUTO DETECT (NO OVERRIDE)
// ✅ Auto view: pc / mobile / cvr
// ✅ WebXR supported -> user can press ENTER VR (via vr-ui.js)
// ✅ Cardboard split: kept as fallback (no query override)
// ✅ Layers mapping for hydration.safe.js via window.HHA_VIEW.layers
// ✅ Failure overlay on import fail

'use strict';

(function(){
  const DOC = document;
  const body = DOC.body;

  // cache-bust token (allow ts/v to bust module import only; NOT used for view selection)
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  // -----------------------------
  // AUTO DETECT VIEW (NO OVERRIDE)
  // -----------------------------
  function isTouch(){
    try{ return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); }catch(_){ return false; }
  }
  function isLikelyMobile(){
    // heuristic only (no override)
    try{
      const ua = (navigator.userAgent || '').toLowerCase();
      if (/android|iphone|ipad|ipod/.test(ua)) return true;
      const w = Math.min(window.innerWidth||9999, window.innerHeight||9999);
      return isTouch() && w <= 900;
    }catch(_){ return false; }
  }
  function isLikelyCardboardCVR(){
    // If user is on mobile + landscape + fullscreen-ish, treat as cVR (crosshair shooting)
    // because in Cardboard rigs, user typically goes fullscreen landscape.
    try{
      const mobile = isLikelyMobile();
      const land = (window.innerWidth > window.innerHeight);
      const fs = !!document.fullscreenElement;
      // Also treat "very wide" as likely landscape usage
      return mobile && land && (fs || window.innerWidth >= 780);
    }catch(_){ return false; }
  }

  function setBodyViewAuto(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');

    // Cardboard split is NOT auto-selected here (kept as fallback mode only).
    // We default to cVR when mobile+landscape looks like headset usage.
    if (isLikelyCardboardCVR()) body.classList.add('view-cvr');
    else if (isLikelyMobile()) body.classList.add('view-mobile');
    else body.classList.add('view-pc');
  }

  setBodyViewAuto();

  // Keep view stable on resize/orientation changes
  let _viewT = 0;
  function scheduleReDetect(){
    const now = Date.now();
    if (now - _viewT < 250) return;
    _viewT = now;
    setTimeout(setBodyViewAuto, 0);
  }
  window.addEventListener('resize', scheduleReDetect);
  window.addEventListener('orientationchange', scheduleReDetect);

  // -----------------------------
  // Layers mapping for hydration.safe.js
  // -----------------------------
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    // Cardboard split uses L/R layers (only if body.cardboard is enabled by some external UX)
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  // -----------------------------
  // Helpers
  // -----------------------------
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
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">Detected view: <b>${escapeHtml(
          body.classList.contains('view-cvr') ? 'cVR' :
          body.classList.contains('view-mobile') ? 'mobile' :
          body.classList.contains('cardboard') ? 'cardboard-split' : 'pc'
        )}</b></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    DOC.body.appendChild(el);
  }

  // -----------------------------
  // Import safe module
  // -----------------------------
  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{
        await import(p);

        // If vr-ui.js already loaded and wants to start, it will trigger hha:start itself.
        // For non-overlay builds, we still ensure start happens once user interacts (tap/click).
        // (hydration.safe.js also has a fallback auto-start if overlay hidden.)
        return;
      }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();