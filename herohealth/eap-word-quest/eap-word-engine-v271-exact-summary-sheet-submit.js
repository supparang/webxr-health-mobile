/* =========================================================
   EAP Word Quest • Exact Summary Compatibility Shim
   Former V271 sender is retired.
   Version: 20260728-EAPWQ-V279-SHIM-FROM-V271
========================================================= */
(function () {
  'use strict';

  var PROOF_TAG = 'eap-word-v278-from-v271';
  var SUBMIT_TAG = 'eap-word-v279-from-v271';

  function load(src,tag,guard) {
    var script;
    if (window[guard]) return;
    if (document.querySelector('script[data-eap-runtime="' + tag + '"]')) return;
    script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute('data-eap-runtime',tag);
    script.onerror = function () {
      console.error('[EAP Word Quest] compatibility module could not load',src);
    };
    document.head.appendChild(script);
  }

  window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ = true;
  load(
    './eap-word-identity-proof-v278.js?v=20260728-v278-runtime-proof-1',
    PROOF_TAG,
    '__EAP_WORD_IDENTITY_PROOF_V278__'
  );
  setTimeout(function () {
    load(
      './eap-word-engine-v279-jsonp-receipt.js?v=20260728-v279-jsonp-receipt-1',
      SUBMIT_TAG,
      '__EAP_WORD_V279_JSONP_RECEIPT__'
    );
  },180);
})();
