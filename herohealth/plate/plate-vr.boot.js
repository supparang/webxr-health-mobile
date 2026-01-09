// === /herohealth/plate/plate-vr.boot.js ===
// PlateVR Boot — PRODUCTION (Auto-detect view, no menu)
// ✅ Auto detect: PC / Mobile / VR / Cardboard / cVR strict
// ✅ Sets body classes: view-pc, view-mobile, cardboard, view-cvr
// ✅ Sets window.HHA_VIEW.layers for safe.js
// ✅ Dispatches hha:start when ready
// ✅ Then imports ./plate-vr.loader.js (which imports plate.safe.js)

'use strict';

(function(){
  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__PLATE_VR_BOOT__) return;
  WIN.__PLATE_VR_BOOT__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  // ---------- detect ----------
  function isMobileUA(){
    const ua = (navigator.userAgent||'').toLowerCase();
    return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
  }
  function hasXR(){
    try{ return !!(navigator.xr); }catch(_){ return false; }
  }
  function isInWebXR(){
    // A-Frame may not be used here; fallback to best effort
    // If you later use A-Frame, you can refine by checking scene.is('vr-mode')
    return false;
  }
  function wantsCVR(){
    // explicit query flag wins (but we don't show UI)
    const v = String(qs('view','')).toLowerCase();
    if (v === 'cvr') return true;
    // optional: allow ?cvr=1
    const c = String(qs('cvr','')).toLowerCase();
    if (c === '1' || c === 'true') return true;
    return false;
  }
  function wantsCardboard(){
    const v = String(qs('view','')).toLowerCase();
    if (v === 'cardboard') return true;
    const cb = String(qs('cardboard','')).toLowerCase();
    if (cb === '1' || cb === 'true') return true;
    return false;
  }

  // ---------- apply view ----------
  function setBodyView(mode){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','cardboard','view-cvr');

    if (mode === 'mobile') b.classList.add('view-mobile');
    else if (mode === 'cardboard') b.classList.add('cardboard');
    else if (mode === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-pc');
  }

  function mapLayers(){
    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
    if (DOC.body.classList.contains('cardboard')){
      cfg.layers = ['plate-layerL','plate-layerR'];
    } else {
      cfg.layers = ['plate-layer'];
    }
  }

  // ---------- auto decide ----------
  function decide(){
    const explicit = String(qs('view','')).toLowerCase();
    if (explicit === 'pc' || explicit === 'mobile' || explicit === 'cardboard' || explicit === 'cvr') return explicit;

    // if user wants strict cVR (shoot from center)
    if (wantsCVR()) return 'cvr';
    if (wantsCardboard()) return 'cardboard';

    // If mobile: default to mobile (touch)
    if (isMobileUA()) return 'mobile';

    // default pc
    return 'pc';
  }

  // ---------- hide old overlay if exists ----------
  function hideStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.classList.add('hide');
  }

  // ---------- bootstrap ----------
  const mode = decide();
  setBodyView(mode);
  mapLayers();
  hideStartOverlay();

  // start event (safe.js listens)
  // small delay so DOM is ready and body class applied
  setTimeout(()=>{ 
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }, 30);

  // now load actual loader (which imports plate.safe.js)
  import('./plate-vr.loader.js').catch((err)=>{
    // readable fail overlay
    const el = DOC.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ PlateVR: boot import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${String(location.href).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}</code></div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${String(err && (err.stack||err.message||err))}</pre>
      </div>
    `;
    DOC.body.appendChild(el);
  });

})();