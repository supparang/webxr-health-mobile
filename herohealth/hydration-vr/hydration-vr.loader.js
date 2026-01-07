// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — AUTO DETECT (NO OVERRIDE)
// ✅ Auto-detect view: pc / mobile / cardboard / cvr
// ✅ Ignores ?view=... (hard lock)  <-- ห้าม override
// ✅ Supports Cardboard split layers via window.HHA_VIEW.layers
// ✅ Shows readable overlay on import failure
// ✅ (optional) loads Universal VR UI if present: ../vr/vr-ui.js

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  }

  const body = document.body;

  // ------------------ HARD RULE: no user override ------------------
  // ignore q.get('view') entirely.

  function isMobileUA(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }

  function isProbablyCardboard(){
    // Heuristic:
    // 1) if in fullscreen + landscape on mobile, likely cardboard attempt
    // 2) if URL contains "cardboard" in path (optional)
    // 3) if user previously played cardboard (persist)
    try{
      const last = localStorage.getItem('HHA_LAST_VIEW') || '';
      if (last === 'cardboard') return true;
    }catch(_){}

    const mobile = isMobileUA();
    const fs = !!document.fullscreenElement;
    const land = (screen.orientation && String(screen.orientation.type||'').includes('landscape')) ||
                 (window.matchMedia && matchMedia('(orientation: landscape)').matches);

    // if mobile + fullscreen + landscape => cardboard-ish
    return !!(mobile && fs && land);
  }

  function isCVRMode(){
    // Heuristic: if mobile + no pointer precision (touch) and we want strict crosshair shooting
    // Use persisted preference ONLY from system decisions (not query)
    try{
      const last = localStorage.getItem('HHA_LAST_VIEW') || '';
      if (last === 'cvr') return true;
    }catch(_){}

    const mobile = isMobileUA();
    // If device has no fine pointer, default to cVR when not cardboard split
    const fine = window.matchMedia && matchMedia('(pointer:fine)').matches;
    return !!(mobile && !fine);
  }

  function detectView(){
    // Priority:
    // 1) If WebXR immersive active => treat as cvr (crosshair) OR pc (but we keep simple)
    // 2) If likely cardboard => cardboard split
    // 3) If mobile touch => cvr (strict aim) as default for kids device
    // 4) Else pc
    const xr = navigator.xr;
    // If XR supported and session already active, we still keep DOM engine; treat as cvr
    if (xr) {
      // can't reliably check active session here; keep as hint only
    }

    if (isProbablyCardboard()) return 'cardboard';
    if (isCVRMode()) return 'cvr';
    if (isMobileUA()) return 'mobile';
    return 'pc';
  }

  const view = detectView();

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');

    try{ localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}
  }
  setBodyView();

  // map layers for safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  // optional: preload Universal VR UI if exists (same standard as other games)
  // (vr-ui.js adds enter/exit/recenter + emits hha:shoot)
  (function maybeLoadVRUI(){
    // Only load for cvr/cardboard/mobile (safe to load anywhere but keep minimal)
    const need = body.classList.contains('view-cvr') || body.classList.contains('cardboard') || body.classList.contains('view-mobile');
    if (!need) return;
    const s = document.createElement('script');
    s.src = withBust('../vr/vr-ui.js');
    s.defer = true;
    s.onerror = ()=>{};
    document.head.appendChild(s);
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
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (AUTO loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">Detected view: <code>${escapeHtml(view)}</code></div>
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

  const candidates = [
    './hydration.safe.js',
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