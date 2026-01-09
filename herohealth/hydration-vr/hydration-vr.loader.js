// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION (AUTO-DETECT)
// ✅ Applies view classes + layers mapping
// ✅ Auto-detect PC vs Mobile if no ?view=...
// ✅ Respects explicit ?view=... (no override)
// ✅ Bust import via ?ts/?v
// ✅ Readable overlay on failure

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const body = document.body;

  // -------------------- auto detect --------------------
  function isTouchDevice(){
    try{
      return (
        'ontouchstart' in window ||
        (navigator.maxTouchPoints|0) > 0 ||
        (navigator.msMaxTouchPoints|0) > 0
      );
    }catch(_){ return false; }
  }

  function detectView(){
    // Respect explicit view (NO override)
    const explicit = String(q.get('view') || '').toLowerCase().trim();
    if (explicit) return explicit;

    // Auto: mobile if touch + small-ish viewport OR mobile UA-ish
    const touch = isTouchDevice();
    const w = Math.min(window.innerWidth||0, window.innerHeight||0) || 0;

    // lightweight UA hint (not relied on alone)
    const ua = String(navigator.userAgent||'').toLowerCase();
    const uaMobile = /android|iphone|ipad|ipod|mobile/.test(ua);

    if (touch && (w <= 900 || uaMobile)) return 'mobile';
    return 'pc';
  }

  const view = detectView();

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // -------------------- layer mapping for safe.js --------------------
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  // -------------------- if no explicit view, write it once (optional) --------------------
  // Helps reproducibility in research logs / reload consistency.
  (function persistViewParam(){
    const hasExplicit = !!String(q.get('view') || '').trim();
    if (hasExplicit) return;

    try{
      const u = new URL(location.href);
      u.searchParams.set('view', view);
      if (!u.searchParams.get('ts')) u.searchParams.set('ts', String(Date.now()));
      // Replace only (no history spam)
      history.replaceState(null, '', u.toString());
    }catch(_){}
  })();

  // -------------------- error overlay --------------------
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
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (auto loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">view: <code>${escapeHtml(view)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${(tried||[]).map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
        <div style="opacity:.85;margin-top:12px;line-height:1.5">
          Tip: ถ้าจะเข้าโหมด Cardboard หรือ cVR ให้เพิ่ม <code>?view=cardboard</code> หรือ <code>?view=cvr</code>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  // -------------------- module import --------------------
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