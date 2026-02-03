// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION (HARDENED)
// ✅ Applies view classes (pc/mobile/cvr/cardboard)
// ✅ Ensures playfield + layers exist (auto-create if missing)
// ✅ Ensures #cbPlayfield hidden toggles correctly
// ✅ Sets window.HHA_VIEW.layers for hydration.safe.js
// ✅ Imports ./hydration.safe.js (ESM)
// ✅ Readable fail overlay

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  }

  const body = document.body;

  function normView(v){
    v = String(v || '').toLowerCase();
    if (v === 'mobile' || v === 'm') return 'mobile';
    if (v === 'cvr' || v === 'cardboardvr') return 'cvr';
    if (v === 'cardboard' || v === 'cb') return 'cardboard';
    return 'pc';
  }

  const view = normView(q.get('view'));

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

  function ensureStyleOnce(){
    if (document.getElementById('hydration-loader-style')) return;
    const st = document.createElement('style');
    st.id = 'hydration-loader-style';
    st.textContent = `
      /* loader: make hidden actually hide, across browsers */
      [hidden]{ display:none !important; }

      /* ensure playfields fixed and not behind */
      #playfield,#cbPlayfield{ position:fixed; inset:0; z-index:10; overflow:hidden; touch-action:manipulation; }
      #hydration-layer,#hydration-layerL,#hydration-layerR{ position:absolute; inset:0; pointer-events:auto; }
      #cbPlayfield .cbHalf{ position:absolute; top:0; bottom:0; width:50%; overflow:hidden; pointer-events:auto; }
      #cbPlayfield .cbHalf.left{ left:0; }
      #cbPlayfield .cbHalf.right{ right:0; }
    `;
    document.head.appendChild(st);
  }

  function ensurePlayfieldStructure(){
    ensureStyleOnce();

    // playfield base
    const pf = ensureEl('div','playfield', document.body);
    pf.setAttribute('aria-label','playfield');
    pf.style.position = 'fixed';
    pf.style.inset = '0';
    pf.style.zIndex = '10';
    pf.style.overflow = 'hidden';
    pf.style.touchAction = 'manipulation';

    // cardboard base
    const cb = ensureEl('div','cbPlayfield', document.body);
    cb.setAttribute('aria-label','cbPlayfield');
    cb.style.position = 'fixed';
    cb.style.inset = '0';
    cb.style.zIndex = '10';
    cb.style.overflow = 'hidden';

    // main layer
    const main = ensureEl('div','hydration-layer', pf);
    main.setAttribute('aria-label','hydration-layer');
    main.style.position = 'absolute';
    main.style.inset = '0';
    main.style.pointerEvents = 'auto';

    // cardboard halves
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

    const L = ensureEl('div','hydration-layerL', left);
    const R = ensureEl('div','hydration-layerR', right);
    L.style.position='absolute'; L.style.inset='0'; L.style.pointerEvents='auto';
    R.style.position='absolute'; R.style.inset='0'; R.style.pointerEvents='auto';

    // show/hide by view
    const isCardboard = body.classList.contains('cardboard');
    if (isCardboard){
      pf.style.display = 'none';
      cb.style.display = 'block';
      cb.hidden = false; // important
    } else {
      pf.style.display = 'block';
      cb.style.display = 'none';
      cb.hidden = true;  // important
    }
  }

  ensurePlayfieldStructure();

  // map layers for hydration.safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
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
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (folder loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">view: <code>${escapeHtml(view)}</code></div>
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