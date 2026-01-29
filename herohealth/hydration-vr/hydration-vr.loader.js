// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (FIX import path)
// ✅ Always import hydration.safe.js from the SAME folder as hydration-vr.html
// ✅ Robust candidate import + clear error UI
// ✅ Adds body classes for view: pc/mobile/vr/cvr (optional)

(function(){
  'use strict';

  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function setErr(msg, extra){
    try{
      console.error(msg, extra||'');
      const el = DOC.getElementById('bootError');
      if (el){
        el.hidden = false;
        el.textContent = String(msg) + (extra ? '\n' + String(extra) : '');
      }
    }catch(_){}
  }

  // ✅ Base = folder of hydration-vr.html (same folder as this loader is referenced from)
  // hydration-vr.html is at /herohealth/hydration-vr/hydration-vr.html
  // so new URL('./', location.href) => /herohealth/hydration-vr/
  function baseFolderURL(){
    try{
      return new URL('./', location.href).toString();
    }catch(_){
      return './';
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