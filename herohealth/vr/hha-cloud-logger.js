// === /herohealth/vr/hha-cloud-logger.js ===
(function(root){
  'use strict';

  const DEFAULT_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzViUBbG-pNLDIXZx7BdFEJj_pf8oFDkRh0_7ryke0nCUdQClPZIZ_k5-qPod14K3DHFA/exec';

  function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{return d;} }
  const ENDPOINT = qs('log', DEFAULT_ENDPOINT);

  function send(payload){
    try{
      fetch(ENDPOINT, {
        method:'POST',
        mode:'no-cors',
        headers:{ 'Content-Type':'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    }catch(_){}
  }

  // public hook
  root.HHA_LOG = function(payload){ send(payload); };

  // auto listeners
  root.addEventListener('hha:start', e=>{
    send({ type:'start', ...e.detail });
  }, {passive:true});

  root.addEventListener('hha:end', e=>{
    send({ type:'end', ...e.detail });
  }, {passive:true});

  root.addEventListener('hha:flush', ()=>{
    // noop: kept for compatibility; end already sent
  }, {passive:true});

})(window);