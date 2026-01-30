// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (FULL)
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr + cardboard
// ✅ Exposes window.HHA_VIEW.layers for Cardboard split layers
// ✅ Robust import hydration.safe.js from SAME folder as this loader (import.meta.url base)
// ✅ Optional: auto-load Universal VR UI (/herohealth/vr/vr-ui.js) if ?vrui=1 OR view=cvr/vr
// ✅ Error UI (creates overlay if page doesn't have #bootError)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  };

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v==='cvr' || v==='cardboard') return 'cvr';
    if (v==='vr') return 'vr';
    if (v==='mobile') return 'mobile';
    if (v==='pc' || v==='desktop') return 'pc';
    return '';
  }

  function getView(){
    // Prefer explicit ?view=
    const v = normalizeView(qs('view',''));
    if (v) return v;

    // fallback by screen/UA
    const ua = (navigator.userAgent||'').toLowerCase();
    const isMobile = /android|iphone|ipad|ipod/.test(ua) ||
      (WIN.matchMedia && WIN.matchMedia('(max-width: 820px)').matches);

    // if XR headset UA
    if (navigator.xr && /oculus|quest|vive|pico|hololens/.test(ua)) return 'vr';

    // if mobile + vr keywords -> cvr
    if (isMobile && /cardboard|vrbox|daydream|gearvr|vr/.test(ua)) return 'cvr';

    return isMobile ? 'mobile' : 'pc';
  }

  function applyViewClass(view){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','cardboard');

    if (view==='cvr'){
      b.classList.add('view-cvr','cardboard'); // HHA convention: cvr counts as cardboard-mode behavior
      // NOTE: page may still use single playfield; "cardboard" is mainly to support helpers/styles
    } else if (view==='vr'){
      b.classList.add('view-vr');
    } else if (view==='mobile'){
      b.classList.add('view-mobile');
    } else {
      b.classList.add('view-pc');
    }

    // Optional: if user explicitly wants split-cardboard view (true L/R)
    // Support ?cardboard=1 to force split layers
    const forceSplit = String(qs('cardboard','0')) === '1';
    if (forceSplit) b.classList.add('cardboard');
  }

  function baseFolderURL(){
    // ✅ CRITICAL: base folder where this loader lives
    try{
      const u = new URL(import.meta.url);
      u.hash = ''; u.search = '';
      u.pathname = u.pathname.replace(/[^/]*$/, ''); // drop filename
      return u.toString();
    }catch(_){
      // fallback to currentScript
      const s = DOC.currentScript;
      if (s && s.src){
        const u = new URL(s.src, location.href);
        u.hash=''; u.search='';
        u.pathname = u.pathname.replace(/[^/]*$/, '');
        return u.toString();
      }
      return new URL('./', location.href).toString();
    }
  }

  function ensureBootErrorEl(){
    let el = DOC.getElementById('bootError');
    if (el) return el;

    // Create overlay error panel if not present
    const wrap = DOC.createElement('div');
    wrap.id = 'bootErrorWrap';
    wrap.style.cssText = [
      'position:fixed','inset:0','z-index:9999',
      'display:none','align-items:center','justify-content:center',
      'padding:16px','background:rgba(2,6,23,.86)','backdrop-filter:blur(10px)'
    ].join(';');

    el = DOC.createElement('pre');
    el.id = 'bootError';
    el.style.cssText = [
      'margin:0','max-width:980px','width:100%',
      'white-space:pre-wrap','word-break:break-word',
      'background:rgba(15,23,42,.80)','border:1px solid rgba(148,163,184,.22)',
      'border-radius:16px','padding:14px','color:#e5e7eb',
      'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
    ].join(';');

    wrap.appendChild(el);
    DOC.body.appendChild(wrap);
    return el;
  }

  function showErr(msg, extra){
    try{
      console.error(msg, extra||'');
      const pre = ensureBootErrorEl();
      const wrap = DOC.getElementById('bootErrorWrap');
      if (wrap) wrap.style.display = 'flex';
      if (pre){
        pre.textContent =
          String(msg) +
          (extra ? '\n\n' + String(extra) : '') +
          '\n\n(ตรวจสอบ path/ไฟล์: hydration.safe.js, import modules, และ console error)';
      }
    }catch(_){}
  }

  async function tryImport(relPath){
    const base = baseFolderURL();
    const url = new URL(relPath, base);
    return import(url.toString());
  }

  function setHHAView(view){
    // Provide layers config so hydration.safe.js can render to correct layer(s)
    // Single playfield layer:
    const main = 'hydration-layer';
    // Split layers for Cardboard:
    const L = 'hydration-layerL';
    const R = 'hydration-layerR';

    const body = DOC.body;
    const split = !!(body && body.classList.contains('cardboard') && DOC.getElementById(L) && DOC.getElementById(R));

    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
      view,
      // ✅ hydration.safe.js reads HHA_VIEW.layers if available
      layers: split ? [L, R] : [main],
      split: split,
      playfieldId: split ? 'cbPlayfield' : 'playfield'
    });
  }

  function shouldLoadVRUI(view){
    // Default OFF (to avoid breaking existing custom crosshair)
    // Enable by: ?vrui=1
    // Or auto-enable in VR/cVR if you want: set AUTO_VRUI=true
    const AUTO_VRUI = false;

    const flag = String(qs('vrui','0')) === '1';
    if (flag) return true;
    if (AUTO_VRUI && (view==='vr' || view==='cvr')) return true;
    return false;
  }

  function injectScript(url){
    return new Promise((resolve, reject)=>{
      try{
        // avoid double load
        const exists = Array.from(DOC.scripts).some(s => (s.src||'') === url);
        if (exists) return resolve(true);

        const s = DOC.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = ()=>resolve(true);
        s.onerror = ()=>reject(new Error('script load failed: ' + url));
        DOC.head.appendChild(s);
      }catch(e){
        reject(e);
      }
    });
  }

  async function loadUniversalVRUI(){
    // vr-ui.js is IIFE script (non-module)
    // Path from hydration-vr/ folder -> ../vr/vr-ui.js
    const base = baseFolderURL();
    const url = new URL('../vr/vr-ui.js', base).toString();
    await injectScript(url);
  }

  async function boot(){
    const view = getView();
    applyViewClass(view);
    setHHAView(view);

    // Optional: load Universal VR UI (ENTER VR/EXIT/RECENTER + crosshair + hha:shoot)
    if (shouldLoadVRUI(view)){
      try{ await loadUniversalVRUI(); }catch(e){ console.warn(e); }
    }

    // Load hydration.safe.js (same folder)
    const v = Date.now();
    const candidates = [
      `./hydration.safe.js?v=${v}`,
      `./hydration.safe.js`
    ];

    let lastErr = null;
    for (const p of candidates){
      try{
        await tryImport(p);
        return; // success
      }catch(e){
        lastErr = e;
      }
    }

    const base = baseFolderURL();
    showErr(
      `❌ HydrationVR: import failed (loader)\nbase: ${base}\nview: ${view}\nTried:\n- ${candidates.join('\n- ')}`,
      lastErr && (lastErr.stack || lastErr.message || String(lastErr))
    );
  }

  // Start boot when DOM ready enough
  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();