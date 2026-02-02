// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION (HARDENED + TARGET-VISIBILITY FIX)
// ✅ Applies view classes
// ✅ Ensures playfield + layers exist (auto-create if missing)
// ✅ Forces layer/target visibility & z-index (fix "targets spawn but invisible")
// ✅ Imports ./hydration.safe.js (ESM)
// ✅ Shows readable overlay on failure

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  }

  const view = String(q.get('view') || '').toLowerCase();
  const body = document.body;

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // ---- HARDEN: Ensure playfield/layers exist even if HTML/HUD got changed ----
  function ensureEl(tag, id, parent){
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement(tag);
    el.id = id;
    parent.appendChild(el);
    return el;
  }

  function ensurePlayfieldStructure(){
    try{
      document.documentElement.style.height = '100%';
      body.style.height = '100%';
      body.style.margin = '0';
      body.style.overflow = 'hidden';
    }catch(_){}

    const pf = ensureEl('div','playfield', body);
    pf.setAttribute('data-playfield','main');
    pf.style.position = 'fixed';
    pf.style.inset = '0';
    pf.style.zIndex = '40';
    pf.style.overflow = 'hidden';
    pf.style.touchAction = 'manipulation';
    pf.style.background = 'transparent';

    const cb = ensureEl('div','cbPlayfield', body);
    cb.setAttribute('data-playfield','cb');
    cb.style.position='fixed';
    cb.style.inset='0';
    cb.style.zIndex='40';
    cb.style.overflow='hidden';
    cb.style.background='transparent';

    const main = ensureEl('div','hydration-layer', pf);
    main.style.position='absolute';
    main.style.inset='0';
    main.style.pointerEvents='auto';

    let left = cb.querySelector('.cbHalf.left');
    if (!left){
      left = document.createElement('div');
      left.className = 'cbHalf left';
      cb.appendChild(left);
    }
    let right = cb.querySelector('.cbHalf.right');
    if (!right){
      right = document.createElement('div');
      right.className = 'cbHalf right';
      cb.appendChild(right);
    }
    left.style.position='absolute'; left.style.top='0'; left.style.bottom='0'; left.style.left='0';
    left.style.width='50%'; left.style.overflow='hidden'; left.style.pointerEvents='auto';

    right.style.position='absolute'; right.style.top='0'; right.style.bottom='0'; right.style.right='0';
    right.style.width='50%'; right.style.overflow='hidden'; right.style.pointerEvents='auto';

    const L = ensureEl('div','hydration-layerL', left);
    const R = ensureEl('div','hydration-layerR', right);
    L.style.position='absolute'; L.style.inset='0'; L.style.pointerEvents='auto';
    R.style.position='absolute'; R.style.inset='0'; R.style.pointerEvents='auto';

    if (body.classList.contains('cardboard')){
      pf.style.display = 'none';
      cb.style.display = 'block';
    } else {
      pf.style.display = 'block';
      cb.style.display = 'none';
    }
  }

  ensurePlayfieldStructure();

  // map layers for safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  // ---- CRITICAL: Force visibility/z-index so targets cannot be hidden by css ----
  (function forceVisibilityCSS(){
    if (document.getElementById('hydration-visibility-fix')) return;
    const st = document.createElement('style');
    st.id = 'hydration-visibility-fix';
    st.textContent = `
      #playfield, #cbPlayfield { z-index: 40 !important; background: transparent !important; }
      #hydration-layer, #hydration-layerL, #hydration-layerR{
        position:absolute !important;
        inset:0 !important;
        display:block !important;
        opacity:1 !important;
        visibility:visible !important;
        z-index:41 !important;
        pointer-events:auto !important;
      }
      .hvr-target{ z-index:42 !important; opacity:1 !important; visibility:visible !important; }
    `;
    document.head.appendChild(st);
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
      try{
        await import(p);
        return;
      }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();