/* EAP Hero live Google Sheets endpoint — Section 122 */
window.EAP_SHEET_CONFIG={
  enabled:true,
  webAppUrl:'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec',
  section:'122',
  course:'EAP Hero: Save the Society'
};

/* Retire cached legacy transports before their script tags execute. */
window.__EAP_PLAYER_RESUME_STABLE_JSONP_V175__=true;
window.__EAP_JSONP_GUARD_RETIRED_V5__=true;

/* Cache-safe bootstrap for the single-flight transport and Sheet authority. */
(function(){
  'use strict';
  function load(src,key){
    if(document.querySelector('script[data-eap-bootstrap="'+key+'"]'))return;
    var script=document.createElement('script');
    script.async=false;
    script.src=src;
    script.dataset.eapBootstrap=key;
    document.head.appendChild(script);
  }
  function boot(){
    load('./eap-player-resume-stable-jsonp-v174.js?v=20260802-resume-transport-v176-single-flight-r1','transport-v176');
    load('./eap-authority-runtime-v1.js?v=20260802-single-sheet-authority-v1-r2','single-authority-v1');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
