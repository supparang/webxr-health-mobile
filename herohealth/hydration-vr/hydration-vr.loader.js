// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — AUTO DETECT (NO MENU)
// ✅ If ?view= exists => respect it (NO override)
// ✅ Else auto-detect: pc vs mobile (safe heuristic)
// ✅ Cardboard/cVR still available via ?view=cardboard or ?view=cvr
// ✅ Sets window.HHA_VIEW.layers for hydration.safe.js
// ✅ Imports ./hydration.safe.js (cache-busted by ?v=ts if provided)

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  function isMobileUA(){
    try{
      const ua = navigator.userAgent || '';
      const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      const coarse = window.matchMedia && window.matchMedia('(any-pointer:coarse)').matches;
      const touch = (navigator.maxTouchPoints|0) > 0;
      return mobile || (coarse && touch);
    }catch(_){ return false; }
  }

  function detectView(){
    // safest: only decide pc vs mobile automatically
    try{
      const fine = window.matchMedia && window.matchMedia('(any-pointer:fine)').matches;
      const mobile = isMobileUA();
      if (!mobile && fine) return 'pc';
      return 'mobile';
    }catch(_){
      return 'pc';
    }
  }

  // --- view: respect existing param, else detect ---
  const viewParam = String(q.get('view') || '').toLowerCase();
  const view = viewParam || detectView();

  const body = document.body;

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // expose view + layers for game
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    cfg.view = view;

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
        <div style="opacity:.9;margin-bottom:10px">view: <b>${escapeHtml(view)}</b> (param: ${escapeHtml(viewParam||'—')})</div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
        <div style="margin-top:10px;opacity:.9;line-height:1.5">
          ✅ เช็กว่าไฟล์นี้มีจริงบน GitHub Pages:
          <ul>
            <li><code>hydration-vr/hydration.safe.js</code></li>
            <li><code>vr/ui-water.js</code></li>
            <li><code>vr/ai-coach.js</code></li>
          </ul>
        </div>
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