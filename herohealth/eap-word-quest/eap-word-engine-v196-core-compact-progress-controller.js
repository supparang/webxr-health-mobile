/* EAP Word Quest • V196 production restore loader
   Restores the verified controller from commit e0c0fe46 before the accidental overwrite.
*/
(function(){
  'use strict';
  var SRC='https://cdn.jsdelivr.net/gh/supparang/webxr-health-mobile@e0c0fe46c2f525d99cb5956f0a7cc6b58620e9f5/herohealth/eap-word-quest/eap-word-engine-v196-core-compact-progress-controller.js';
  if(window.__EAP_WORD_V196_CORE_CONTROLLER__)return;
  if(document.readyState==='loading'){
    document.write('<script src="'+SRC+'"><\/script>');
    return;
  }
  var s=document.createElement('script');
  s.src=SRC;
  s.async=false;
  s.onload=function(){console.info('[EAP Word Quest] V196 production controller restored');};
  s.onerror=function(){console.error('[EAP Word Quest] V196 production controller restore failed');};
  document.head.appendChild(s);
})();
