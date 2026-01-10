// === /herohealth/hydration-vr/hydration-vr.boot.js ===
// HydrationVR Boot — PRODUCTION (HHA Standard)
// ✅ Auto-detect view default (PC/Mobile) — no menu
// ✅ Optional view passthrough from hub: ?view=cardboard|cvr|pc|mobile
// ✅ Sets window.HHA_VIEW.layers for hydration.safe.js
// ✅ Starts game (dispatch hha:start) after DOM + vr-ui ready best-effort
// ✅ Cache-bust module imports with ?v=ts

'use strict';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  function isLikelyMobile(){
    const ua = navigator.userAgent || '';
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    const small = Math.min(WIN.innerWidth||9999, WIN.innerHeight||9999) <= 900;
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    return (touch && small) || uaMobile;
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','cardboard','view-cvr');

    if (view === 'mobile') b.classList.add('view-mobile');
    else if (view === 'cardboard') b.classList.add('cardboard');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-pc');
  }

  function setLayersByBody(){
    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
    if (DOC.body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  }

  // --- choose view ---
  // ✅ Default: auto pc/mobile
  // ✅ If hub passes ?view=... we honor it (no in-page menu, but hub can set mode)
  let view = String(qs('view','') || '').toLowerCase().trim();

  if (!view){
    view = isLikelyMobile() ? 'mobile' : 'pc';
  } else {
    // normalize
    if (view === 'pc') view = 'pc';
    else if (view === 'mobile') view = 'mobile';
    else if (view === 'cardboard') view = 'cardboard';
    else if (view === 'cvr') view = 'cvr';
    else view = isLikelyMobile() ? 'mobile' : 'pc';
  }

  setBodyView(view);
  setLayersByBody();

  // if no ts, attach ts so hub/reloads are cache-safe
  try{
    const u = new URL(location.href);
    if (!u.searchParams.get('ts')) u.searchParams.set('ts', String(Date.now()));
    // do NOT rewrite if already has view (avoid loop)
    if (!qs('ts')) {
      // only if ts was missing entirely
      history.replaceState(null, '', u.toString());
    }
  }catch(_){}

  // ---- boot import hydration.safe.js ----
  async function bootImport(){
    // hydrate safe
    const candidates = [ './hydration.safe.js' ].map(withBust);
    let lastErr = null;

    for (const p of candidates){
      try{
        await import(p);
        return true;
      }catch(err){
        lastErr = err;
      }
    }

    // fallback overlay
    try{
      const el = DOC.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
      el.innerHTML = `
        <div style="max-width:900px;margin:0 auto">
          <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (boot)</h2>
          <div style="opacity:.9;margin-bottom:10px">URL: <code>${String(location.href).replace(/</g,'&lt;')}</code></div>
          <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${String(lastErr && (lastErr.stack || lastErr.message || lastErr)).replace(/</g,'&lt;')}</pre>
        </div>
      `;
      DOC.body.appendChild(el);
    }catch(_){}
    return false;
  }

  function fireStart(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  // start when ready (allow vr-ui to mount first)
  (async()=>{
    const ok = await bootImport();
    if (!ok) return;

    // best-effort delay: vr-ui.js is defer, but allow it to finish mounting
    setTimeout(()=>fireStart(), 60);
  })();

})();