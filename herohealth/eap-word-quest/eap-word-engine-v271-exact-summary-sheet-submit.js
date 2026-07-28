/* =========================================================
   EAP Word Quest • Exact Summary Compatibility Shim
   Former V271 sender is retired.
   Version: 20260728-EAPWQ-V277-SHIM-FROM-V271
========================================================= */
(function () {
  'use strict';
  var TAG = 'eap-word-v277-from-v271';
  var script;

  if (window.__EAP_WORD_V277_SHEET_CONFIRMED_PROGRESS__) return;
  if (document.querySelector('script[data-eap-runtime="' + TAG + '"]')) return;

  window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ = true;
  script = document.createElement('script');
  script.src = './eap-word-engine-v277-sheet-confirmed-progress.js?v=20260728-v277-sheet-confirmed-1';
  script.async = false;
  script.setAttribute('data-eap-runtime',TAG);
  script.onerror = function () {
    console.error('[EAP Word Quest] V277 Sheet-confirmed progress could not load from V271 shim');
  };
  document.head.appendChild(script);
})();
