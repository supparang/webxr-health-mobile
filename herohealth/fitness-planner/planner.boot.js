// === /herohealth/fitness-planner/planner.boot.js ===
// Loader for planner.safe.js
// Fixes: "planner.safe.js not loaded or missing"

'use strict';

(function(){
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.defer=true;
      s.onload=()=>resolve(true);
      s.onerror=()=>reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
  }

  function err(msg, e){
    console.error(msg, e||'');
    try{
      const d=document.createElement('div');
      d.style.cssText='position:fixed;left:12px;right:12px;top:12px;z-index:99999;padding:12px 14px;border-radius:16px;background:rgba(127,29,29,.92);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.95);font-weight:900;';
      d.textContent = msg + (e && e.message ? (' — '+e.message) : '');
      document.body.appendChild(d);
    }catch(_){}
  }

  async function boot(){
    try{
      // always try to load safe
      await loadScript('./planner.safe.js?v=1');
      if(!window.HHA_FITNESS_PLANNER || typeof window.HHA_FITNESS_PLANNER.boot !== 'function'){
        throw new Error('HHA_FITNESS_PLANNER.boot() missing');
      }
      window.HHA_FITNESS_PLANNER.boot();
    }catch(e){
      err('Error: planner.safe.js not loaded or missing', e);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();