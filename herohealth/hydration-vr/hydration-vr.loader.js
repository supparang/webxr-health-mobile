// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — HARDEN PATCH (debug + import status + view/layers mapping)
// ✅ Applies view classes + layers mapping
// ✅ Imports ./hydration.safe.js with cache bust support
// ✅ Visible overlay on failure
// ✅ Debug state on window.__HHA_HYDRATION_LOADER__
// ✅ Guard against duplicate loader run

'use strict';

(function(){
  // ---- duplicate guard ----
  if (window.__HHA_HYDRATION_LOADER_RUNNING__) {
    try { console.warn('[HydrationVR.loader] already running, skip duplicate'); } catch(_) {}
    return;
  }
  window.__HHA_HYDRATION_LOADER_RUNNING__ = true;

  const DOC = document;
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  const DBG = window.__HHA_HYDRATION_LOADER__ = {
    startedAt: Date.now(),
    href: location.href,
    baseURI: document.baseURI,
    view: null,
    bodyClass: null,
    tried: [],
    imported: null,
    status: 'booting',
    error: null
  };

  function log(...args){
    try { console.log('[HydrationVR.loader]', ...args); } catch(_) {}
  }

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const view = String(q.get('view') || '').toLowerCase();
  DBG.view = view;

  const body = DOC.body;

  function setBodyView(){
    try{
      body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');

      if (view === 'mobile') body.classList.add('view-mobile');
      else if (view === 'cardboard') body.classList.add('cardboard');
      else if (view === 'cvr') body.classList.add('view-cvr');
      else body.classList.add('view-pc');

      DBG.bodyClass = body.className;
      log('view class set:', body.className);
    }catch(err){
      log('setBodyView error:', err);
    }
  }
  setBodyView();

  // map layers for safe.js
  (function setLayers(){
    try{
      const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
      if (body.classList.contains('cardboard')){
        cfg.layers = ['hydration-layerL','hydration-layerR'];
      } else {
        cfg.layers = ['hydration-layer'];
      }
      log('layers mapped:', cfg.layers);
    }catch(err){
      log('setLayers error:', err);
    }
  })();

  // optional tiny status badge (debug only; removed after success)
  let statusEl = null;
  function showStatus(text){
    try{
      if (!statusEl){
        statusEl = DOC.createElement('div');
        statusEl.id = 'hvr-loader-status';
        statusEl.style.cssText = [
          'position:fixed',
          'left:10px',
          'top:10px',
          'z-index:99998',
          'background:rgba(2,6,23,.78)',
          'color:#e5e7eb',
          'border:1px solid rgba(148,163,184,.22)',
          'border-radius:12px',
          'padding:6px 10px',
          'font:12px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial',
          'box-shadow:0 10px 30px rgba(0,0,0,.35)',
          'backdrop-filter:blur(8px)',
          'pointer-events:none'
        ].join(';');
        DOC.body.appendChild(statusEl);
      }
      statusEl.textContent = text;
    }catch(_){}
  }

  function hideStatusLater(ms=700){
    try{
      if (!statusEl) return;
      setTimeout(()=>{
        try{ statusEl.remove(); }catch(_){}
        statusEl = null;
      }, ms);
    }catch(_){}
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[m]));
  }

  function collectDomDebug(){
    let info = {};
    try{
      const pf = DOC.getElementById('playfield');
      const cb = DOC.getElementById('cbPlayfield');
      const layer = DOC.getElementById('hydration-layer');
      const layerL = DOC.getElementById('hydration-layerL');
      const layerR = DOC.getElementById('hydration-layerR');
      const ov = DOC.getElementById('startOverlay');

      const rectOf = (el)=>{
        try{
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            w: Math.round(r.width),
            h: Math.round(r.height),
            x: Math.round(r.left),
            y: Math.round(r.top)
          };
        }catch(_){ return null; }
      };

      info = {
        bodyClass: DOC.body?.className || '',
        hasPlayfield: !!pf,
        hasCbPlayfield: !!cb,
        hasLayer: !!layer,
        hasLayerL: !!layerL,
        hasLayerR: !!layerR,
        hasStartOverlay: !!ov,
        startOverlayHidden: !!(ov && (ov.classList.contains('hide') || getComputedStyle(ov).display === 'none')),
        rectPlayfield: rectOf(pf),
        rectCbPlayfield: rectOf(cb),
        rectLayer: rectOf(layer),
        rectLayerL: rectOf(layerL),
        rectLayerR: rectOf(layerR)
      };
    }catch(err){
      info = { error: String(err && (err.stack || err.message || err)) };
    }
    return info;
  }

  function showFail(err, tried){
    DBG.status = 'failed';
    DBG.error = String(err && (err.stack || err.message || err));

    const domDbg = collectDomDebug();

    const el = DOC.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'background:rgba(2,6,23,.94)',
      'color:#e5e7eb',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial',
      'padding:16px',
      'overflow:auto'
    ].join(';');

    el.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (loader harden)</h2>

        <div style="opacity:.95;margin-bottom:8px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.95;margin-bottom:8px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.95;margin-bottom:8px">view: <code>${escapeHtml(view || '(none)')}</code></div>
        <div style="opacity:.95;margin-bottom:12px">body.className: <code>${escapeHtml(document.body?.className || '')}</code></div>

        <div style="margin:12px 0 8px 0;font-weight:700">Tried import paths:</div>
        <ol style="line-height:1.55;margin-top:0">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>

        <div style="margin:12px 0 6px 0;font-weight:700">DOM debug:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(JSON.stringify(domDbg, null, 2))}</pre>

        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>

        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="hvr-reload-btn" style="cursor:pointer;padding:8px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.2);background:rgba(34,211,238,.12);color:#e5e7eb">🔁 Reload</button>
          <button id="hvr-copydbg-btn" style="cursor:pointer;padding:8px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.2);background:rgba(34,197,94,.12);color:#e5e7eb">📋 Copy Debug</button>
        </div>
      </div>
    `;

    DOC.body.appendChild(el);

    try{
      el.querySelector('#hvr-reload-btn')?.addEventListener('click', ()=>{
        const u = new URL(location.href);
        u.searchParams.set('ts', String(Date.now()));
        location.href = u.toString();
      });

      el.querySelector('#hvr-copydbg-btn')?.addEventListener('click', async ()=>{
        const payload = {
          loader: window.__HHA_HYDRATION_LOADER__,
          dom: domDbg,
          error: String(err && (err.stack || err.message || err))
        };
        const txt = JSON.stringify(payload, null, 2);
        try{
          await navigator.clipboard.writeText(txt);
        }catch(_){}
      });
    }catch(_){}
  }

  // candidate imports (relative to hydration-vr.html folder)
  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  DBG.tried = candidates.slice();

  (async()=>{
    showStatus('Hydration loader: importing…');
    DBG.status = 'importing';
    log('start', { view, candidates });

    for (const p of candidates){
      try{
        log('try import:', p);
        await import(p);

        DBG.imported = p;
        DBG.status = 'ok';
        log('import ok:', p);

        showStatus('Hydration loader: ready ✅');
        hideStatusLater(800);

        return;
      }catch(err){
        log('import fail:', p, err);
        DBG.lastImportError = String(err && (err.stack || err.message || err));
      }
    }

    showStatus('Hydration loader: failed ❌');
    showFail(new Error('All candidate imports failed.'), candidates);
  })().catch(err=>{
    log('fatal loader error:', err);
    showFail(err, candidates);
  });
})();