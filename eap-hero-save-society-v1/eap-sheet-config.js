/* EAP Hero live Google Sheets endpoint — Section 122 */
window.EAP_SHEET_CONFIG={
  enabled:true,
  webAppUrl:'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec',
  section:'122',
  course:'EAP Hero: Save the Society'
};

/* Cache-safe bootstrap for the single Sheet-authority runtime. */
(function(){
  'use strict';
  function loadAuthority(){
    if(window.__EAP_SINGLE_AUTHORITY_V1__||document.querySelector('script[data-eap-authority-bootstrap="single-v1"]'))return;
    var script=document.createElement('script');
    script.async=false;
    script.src='./eap-authority-runtime-v1.js?v=20260802-single-sheet-authority-v1-r1';
    script.dataset.eapAuthorityBootstrap='single-v1';
    document.head.appendChild(script);
  }
  if(document.readyState==='complete')setTimeout(loadAuthority,0);
  else window.addEventListener('load',loadAuthority,{once:true});
})();
