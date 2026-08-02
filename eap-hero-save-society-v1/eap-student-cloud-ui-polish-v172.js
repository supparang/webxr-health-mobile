/* =========================================================
   EAP Hero • Final Authority Loader
   Loads the single Sheet-authority runtime after the application modules.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_AUTHORITY_RUNTIME_V1_LOADER__)return;
  window.__EAP_AUTHORITY_RUNTIME_V1_LOADER__=true;

  function hideLegacyStudentControls(){
    var patterns=[/^Local Sheet log:\s*\d+\s*attempts/i,/ส่งผลล่าสุด.*Sheet/i];
    Array.prototype.slice.call(document.querySelectorAll('body *')).forEach(function(node){
      var value=String(node.textContent||'').replace(/\s+/g,' ').trim();
      if(!patterns.some(function(pattern){return pattern.test(value);})){return;}
      var target=node.closest('button,a,[role="button"]')||node;
      target.style.setProperty('display','none','important');
      target.setAttribute('aria-hidden','true');
    });
  }

  var script=document.createElement('script');
  script.async=false;
  script.src='./eap-authority-runtime-v1.js?v=20260802-single-sheet-authority-v1';
  script.dataset.eapAuthorityLoader='single-v1';
  script.onload=function(){
    hideLegacyStudentControls();
    try{window.dispatchEvent(new CustomEvent('eap:authority-runtime-ready'));}catch(_){}
  };
  script.onerror=function(){
    console.error('[EAP] Single authority runtime failed to load');
  };
  document.head.appendChild(script);

  new MutationObserver(hideLegacyStudentControls).observe(document.documentElement,{childList:true,subtree:true});
})();
