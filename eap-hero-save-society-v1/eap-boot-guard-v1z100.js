/* EAP Hero v1z100 – safe boot fallback */
(() => {
  'use strict';
  function recover(){
    const app=document.getElementById('app');
    if(app && (app.textContent||'').trim().length<10 && window.EAPHero){
      const restore=window.EAPHero.forceHome || window.EAPHero.map;
      if(typeof restore==='function') restore();
    }
  }
  window.addEventListener('load',()=>{ setTimeout(recover,700); setTimeout(recover,1600); });
})();
