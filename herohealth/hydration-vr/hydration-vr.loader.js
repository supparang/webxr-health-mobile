// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (FIX import path)
// ✅ Always import hydration.safe.js from the SAME folder as this loader
// ✅ Robust candidate import + clear error UI
// ✅ Adds body classes for view: pc/mobile/vr/cvr (optional)

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
        el.style.cssText = [
          'position:fixed',
          'left:12px','right:12px','bottom:12px',
          'z-index:9999',
          'max-height:44vh',
          'overflow:auto',
          'white-space:pre-wrap',
          'padding:12px',
          'border-radius:14px',
          'border:1px solid rgba(239,68,68,.35)',
          'background:rgba(2,6,23,.86)',
          'color:#fca5a5',
          'font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace'
        ].join(';');
        DOC.body.appendChild(el);
      }
      el.hidden = false;
      el.textContent = String(msg) + (extra ? '\n' + String(extra) : '');
    }catch(_){}
  }

  // ✅ CRITICAL: base must be the folder containing this loader
  // If this loader is at /herohealth/hydration-vr/hydration-vr.loader.js
  // then base becomes /herohealth/hydration-vr/
  function baseFolderURL(){
    try{
      const u = new URL(import.meta.url);
      u.hash = '';
      u.search = '';
      u.pathname = u.pathname.replace(/[^/]*$/, ''); // drop filename
      return u.toString();
    }catch(_){
      // Fallback: use script src (works if loaded as classic script)
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

  async function boot(){
    applyViewClass();

    // cache-bust per load
    const v = Date.now();

    // hydration.safe.js MUST be in same folder: /herohealth/hydration-vr/hydration.safe.js
    const candidates = [
      `./hydration.safe.js?v=${v}`,
      `./hydration.safe.js`
    ];

    let lastErr = null;

    for (const p of candidates){
      try{
        await tryImport(p);
        return; // ✅ success
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