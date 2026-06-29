/* CSAI2102 AI Quest — S2 AR Result Bridge v4.0.4 compatibility shim
   Older cached Student Pages may still request this filename.  Delegate them
   to the reliable V405 S1-mirrored event bridge instead of running two senders.
*/
(() => {
  'use strict';
  if (window.AIQUEST_S2_AR_RESULT_BRIDGE?.version?.includes('v4.0.5')) return;
  if (document.querySelector('script[data-aiquest-s2-bridge-v405]')) return;
  const script = document.createElement('script');
  script.src = './js/aiquest-s2-ar-result-bridge-v405.js?v=20260629-s2bridge405';
  script.async = false;
  script.dataset.aiquestS2BridgeV405 = '1';
  document.head.appendChild(script);
})();
