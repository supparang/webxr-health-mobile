/* =========================================================
   EAP Word Quest • Exact Summary Compatibility Shim
   Former V271 sender is retired.
   Version: 20260728-EAPWQ-V278-SHIM-FROM-V271
========================================================= */
(function () {
  'use strict';

  var PROOF_TAG = 'eap-word-v278-from-v271';
  var SUMMARY_TAG = 'eap-word-v277-from-v271';

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
      './eap-word-engine-v277-sheet-confirmed-progress.js?v=20260728-v277-sheet-confirmed-2',
      SUMMARY_TAG,
      '__EAP_WORD_V277_SHEET_CONFIRMED_PROGRESS__'
    );
  },180);
})();
