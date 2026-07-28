/* =========================================================
   EAP Word Quest • Authority Compatibility Shim
   Former V272 observer client has been retired.
   Version: 20260728-V274-SHIM-NO-DOM-OBSERVER
========================================================= */
(function () {
  'use strict';

  var TAG = 'eap-word-authority-v274-shim';
  var script;

  if (window.__EAP_WORD_AUTHORITY_V274__) return;
  if (document.querySelector('script[data-eap-runtime="' + TAG + '"]')) return;

  /* Mark the former implementation as disabled for all cached loaders. */
  window.__EAP_WORD_AUTHORITY_V272__ = true;

  script = document.createElement('script');
  script.src = './eap-word-authority-v274.js?v=20260728-v274-no-observer-2';
  script.async = false;
  script.setAttribute('data-eap-runtime',TAG);
  script.onerror = function () {
    console.error('[EAP Word Quest] V274 Authority client could not load from V272 shim');
  };
  document.head.appendChild(script);
})();
