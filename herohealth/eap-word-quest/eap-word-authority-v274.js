/* =========================================================
   EAP Word Quest • Authority Compatibility Shim
   V274 is retired and forwards to V275 + V276.
   Version: 20260728-V276-SHIM-FROM-V274
========================================================= */
(function () {
  'use strict';
  var AUTH_TAG = 'eap-word-authority-v275-from-v274';
  var NAME_TAG = 'eap-word-name-fallback-v276-from-v274';

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

  window.__EAP_WORD_AUTHORITY_V274__ = true;
  window.__EAP_WORD_AUTHORITY_V272__ = true;
  load('./eap-word-authority-v275.js?v=20260728-v275-proof-1',AUTH_TAG,'__EAP_WORD_AUTHORITY_V275__');
  setTimeout(function () {
    load('./eap-word-name-fallback-v276.js?v=20260728-v276-name-fallback-1',NAME_TAG,'__EAP_WORD_NAME_FALLBACK_V276__');
  },120);
})();
