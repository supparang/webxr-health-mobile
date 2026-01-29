// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PATCH: robust import paths + cache-bust
'use strict';

(function(){
  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  async function tryImport(paths){
    const tried = [];
    for (const p of paths){
      tried.push(p);
      try{
        // eslint-disable-next-line no-unused-vars
        const mod = await import(p);
        return { ok:true, mod, tried };
      }catch(e){
        // continue
      }
    }
    return { ok:false, tried };
  }

  function showError(title, url, baseURI, tried, err){
    const pre = DOC.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;padding:14px;border-radius:14px;border:1px solid rgba(239,68,68,.25);background:rgba(2,6,23,.75);color:#fee2e2;font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    pre.textContent =
      `❌ ${title}\n`+
      `URL: ${url}\n`+
      `baseURI: ${baseURI}\n`+
      `Tried paths:\n` + tried.map(t=>' - '+t).join('\n') + '\n' +
      (err ? `\nError:\n${String(err?.stack || err)}` : '');
    DOC.body.appendChild(pre);
  }

  async function boot(){
    const v = String(qs('v', Date.now()));
    const baseURI = location.href;

    // candidates: most-likely first
    const candidates = [
      `./hydration.safe.js?v=${v}`,
      `./hydration.safe.js?ts=${v}`,
      `./hydration.safe.js`,

      // fallbacks (in case structure changed)
      `../hydration-vr/hydration.safe.js?v=${v}`,
      `../hydration-vr/hydration.safe.js`,
      `../hydration.safe.js?v=${v}`,
      `../hydration.safe.js`,
    ];

    const res = await tryImport(candidates);
    if (!res.ok){
      showError('HydrationVR: import failed (folder loader)', location.href, baseURI, res.tried, new Error('All candidate imports failed.'));
      return;
    }

    // If hydration.safe.js expects start signal from overlay:
    // You likely already do this in your HTML; keep it safe here too.
    try{
      // Optional: auto fire hha:start after user hits Start in your overlay.
      // (No-op here to avoid double-start.)
    }catch(_){}
  }

  boot();
})();