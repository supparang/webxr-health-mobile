// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (fixed base path + view classes + layers)
// ✅ Base path resolves from import.meta.url (same folder)
// ✅ Applies body classes: view-pc / view-mobile / view-vr / view-cvr + cardboard
// ✅ Provides window.HHA_VIEW.layers for SAFE (cardboard L/R)
// ✅ Robust import candidates + clear error UI

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function setErr(msg, extra){
    try{
      console.error(msg, extra||'');
      let el = DOC.getElementById('bootError');
      if (!el){
        el = DOC.createElement('pre');
        el.id = 'bootError';
        el.style.position = 'fixed';
        el.style.left = '12px';
        el.style.right = '12px';
        el.style.bottom = '12px';
        el.style.zIndex = '9999';
        el.style.padding = '12px';
        el.style.borderRadius = '14px';
        el.style.border = '1px solid rgba(239,68,68,.35)';
        el.style.background = 'rgba(2,6,23,.88)';
        el.style.color = 'rgba(229,231,235,.95)';
        el.style.whiteSpace = 'pre-wrap';
        el.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        DOC.body.appendChild(el);
      }
      el.hidden = false;
      el.textContent = String(msg) + (extra ? '\n' + String(extra) : '');
    }catch(_){}
  }

  function baseFolderURL(){
    try{
      const u = new URL(import.meta.url);
      u.hash = '';
      u.search = '';
      u.pathname = u.pathname.replace(/[^/]*$/, ''); // drop filename
      return u.toString();
    }catch(_){
      // fallback: currentScript src
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

  async function tryImport(relPath){
    const base = baseFolderURL();
    const url = new URL(relPath, base);
    return import(url.toString());
  }

  function applyViewClass(){
    const v = String(qs('view','')).toLowerCase();
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','cardboard');
    if (v==='cvr' || v==='cardboard'){
      b.classList.add('view-cvr','cardboard');
    } else if (v==='vr'){
      b.classList.add('view-vr');
    } else if (v==='mobile'){
      b.classList.add('view-mobile');
    } else {
      b.classList.add('view-pc');
    }
  }

  function wireLayers(){
    // Provide standard layer IDs for SAFE
    // - PC/Mobile/cVR: hydration-layer
    // - Cardboard: hydration-layerL / hydration-layerR
    try{
      const b = DOC.body;
      const isCardboard = b && b.classList.contains('cardboard');

      const main = DOC.getElementById('hydration-layer');
      const L = DOC.getElementById('hydration-layerL');
      const R = DOC.getElementById('hydration-layerR');

      const layers = (isCardboard && L && R) ? ['hydration-layerL','hydration-layerR']
                   : (main ? ['hydration-layer'] : []);

      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = layers;

      // Optional: expose playfield ids for debugging
      WIN.HHA_VIEW.playfield = isCardboard ? 'cbPlayfield' : 'playfield';
    }catch(_){}
  }

  async function boot(){
    applyViewClass();
    wireLayers();

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
    setErr(
      `❌ HydrationVR: import failed (loader)\nbase: ${base}\nTried:\n- ${candidates.join('\n- ')}`,
      lastErr && (lastErr.stack || lastErr.message || String(lastErr))
    );
  }

  boot();
})();