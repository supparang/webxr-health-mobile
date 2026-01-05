// === /herohealth/vr/hha-cloud-logger.js ===
// Minimal logger stub (safe). If you already have full logger, keep yours.

(function(){
  'use strict';
  if (window.__HHA_LOGGER__) return;
  window.__HHA_LOGGER__ = true;

  // Listens to hha:end and tries to POST to ?log= endpoint if present.
  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  }
  const endpoint = String(qs('log','') || '');

  window.addEventListener('hha:end', async (ev)=>{
    if (!endpoint) return;
    const payload = ev?.detail || {};
    try{
      await fetch(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        keepalive:true
      });
    }catch(_){}
  });
})();