// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — AUTO DETECT (B)
// ✅ No menu, no query override (ignores ?view=...)
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Toggles Cardboard on real WebXR enter-vr
// ✅ Maps layers for hydration.safe.js via window.HHA_VIEW.layers
// ✅ Imports ./hydration.safe.js
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

  // ---------------- Auto Detect (NO OVERRIDE) ----------------
  function isLikelyMobile(){
    try{
      const ua = navigator.userAgent || '';
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const small = Math.min(window.innerWidth||9999, window.innerHeight||9999) < 760;
      return coarse || small || /Android|iPhone|iPad|iPod/i.test(ua);
    }catch(_){
      return false;
    }
  }

  function setBodyBaseView(){
    body.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    if (isLikelyMobile()){
      // default mobile = touch mode (not strict crosshair)
      body.classList.add('view-mobile');
    } else {
      body.classList.add('view-pc');
    }
  }

  function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    // In cardboard => use L/R layers. Otherwise single.
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  }

  setBodyBaseView();
  setLayers();

  // ---------------- WebXR Enter VR => Cardboard + strict crosshair ----------------
  // We do NOT read ?view=... at all.
  function bindAFrameEnterExit(){
    try{
      const scene = document.querySelector('a-scene');
      if (!scene) return;

      scene.addEventListener('enter-vr', ()=>{
        // Real immersive session entered -> Cardboard mode ON
        body.classList.add('cardboard');
        // In cardboard we want strict crosshair shooting behavior (cVR)
        body.classList.remove('view-pc','view-mobile');
        body.classList.add('view-cvr');
        setLayers();

        // show cb container, hide normal playfield
        const cb = document.getElementById('cb');
        const pf = document.getElementById('playfield');
        if (cb) cb.classList.add('on');
        if (pf) pf.classList.add('off');
      });

      scene.addEventListener('exit-vr', ()=>{
        // back to base mode
        body.classList.remove('cardboard','view-cvr');
        setBodyBaseView();
        setLayers();

        const cb = document.getElementById('cb');
        const pf = document.getElementById('playfield');
        if (cb) cb.classList.remove('on');
        if (pf) pf.classList.remove('off');
      });
    }catch(_){}
  }

  // Some devices need a moment before scene exists
  setTimeout(bindAFrameEnterExit, 80);
  setTimeout(bindAFrameEnterExit, 500);

  // Optional: if user uses Cardboard viewer without WebXR,
  // they can still play in strict crosshair by "view-cvr" automatic trigger
  // when device is mobile + fullscreen + landscape.
  function maybeEnableCVRSoft(){
    try{
      if (!isLikelyMobile()) return;
      // only if not in VR already
      if (body.classList.contains('cardboard')) return;

      const landscape = (window.innerWidth || 0) > (window.innerHeight || 0);
      const fs = !!document.fullscreenElement;
      if (landscape && fs){
        body.classList.remove('view-mobile','view-pc');
        body.classList.add('view-cvr');
        setLayers();
      } else if (body.classList.contains('view-cvr')) {
        // revert to mobile if conditions not met
        body.classList.remove('view-cvr');
        body.classList.add('view-mobile');
        setLayers();
      }
    }catch(_){}
  }

  window.addEventListener('resize', maybeEnableCVRSoft);
  document.addEventListener('fullscreenchange', maybeEnableCVRSoft);
  setTimeout(maybeEnableCVRSoft, 250);

  // ---------------- Failure overlay ----------------
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