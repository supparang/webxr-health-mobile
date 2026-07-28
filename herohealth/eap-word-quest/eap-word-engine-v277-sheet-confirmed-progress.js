/* =========================================================
   EAP Word Quest • V277 Compatibility Shim
   V277 hidden-iframe sender is retired.
   Version: 20260728-EAPWQ-V279-SHIM-FROM-V277
========================================================= */
(function () {
  'use strict';
  var TAG = 'eap-word-v279-from-v277';
  var script;

  if (window.__EAP_WORD_V279_JSONP_RECEIPT__) return;
  if (document.querySelector('script[data-eap-runtime="' + TAG + '"]')) return;

  window.__EAP_WORD_V277_SHEET_CONFIRMED_PROGRESS__ = true;
  script = document.createElement('script');
  script.src = './eap-word-engine-v279-jsonp-receipt.js?v=20260728-v279-jsonp-receipt-1';
  script.async = false;
  script.setAttribute('data-eap-runtime',TAG);
  script.onerror = function () {
    console.error('[EAP Word Quest] V279 JSONP sender could not load from V277 shim');
  };
  document.head.appendChild(script);
})();
