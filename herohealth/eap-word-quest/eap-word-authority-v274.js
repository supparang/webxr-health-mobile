/* =========================================================
   EAP Word Quest • Authority Compatibility Shim
   V274 is retired and forwards to V275 verification-proof client.
   Version: 20260728-V275-SHIM
========================================================= */
(function () {
  'use strict';
  var TAG = 'eap-word-authority-v275-from-v274';
  var script;
  if (window.__EAP_WORD_AUTHORITY_V275__) return;
  if (document.querySelector('script[data-eap-runtime="' + TAG + '"]')) return;
  window.__EAP_WORD_AUTHORITY_V274__ = true;
  window.__EAP_WORD_AUTHORITY_V272__ = true;
  script = document.createElement('script');
  script.src = './eap-word-authority-v275.js?v=20260728-v275-proof-1';
  script.async = false;
  script.setAttribute('data-eap-runtime',TAG);
  script.onerror = function () {
    console.error('[EAP Word Quest] V275 Authority client could not load from V274 shim');
  };
  document.head.appendChild(script);
})();
