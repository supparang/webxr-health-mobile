/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   Version: 20260731-V289-PROFILE-ACTIONS-STABILITY-BOOTSTRAP
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-V289-PROFILE-ACTIONS-STABILITY-BOOTSTRAP';
  if (window.__EAP_WORD_V289_BOOTSTRAP__) return;
  window.__EAP_WORD_V289_BOOTSTRAP__ = true;
  window.__EAP_WORD_AUTHORITY_V272__ = true;
  window.__EAP_WORD_AUTHORITY_V274__ = true;

  function loadScript(src, tag, guard, onload, onerror) {
    var script;
    if (window[guard]) return;
    if (document.querySelector('script[data-eap-runtime="' + tag + '"]')) return;
    script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute('data-eap-runtime', tag);
    if (onload) script.onload = onload;
    if (onerror) script.onerror = onerror;
    document.head.appendChild(script);
  }

  function showAuthorityLoadError() {
    var panel = document.getElementById('eapWordAuthorityPanel');
    if (!panel) return;
    panel.textContent = 'โหลดระบบยืนยันตัวตนไม่สำเร็จ กรุณาปิดแท็บแล้วเปิดหน้าใหม่';
  }

  loadScript('./eap-word-profile-actions-stability-v289.js?v=20260731-v289-profile-actions-1', 'eap-v289', '__EAP_WORD_PROFILE_ACTIONS_STABILITY_V289__');
  loadScript('./eap-word-sheet-resume-rehydrate-v281.js?v=20260731-v281-2', 'eap-v281', '__EAP_WORD_V281_SHEET_REHYDRATE__');
  setTimeout(function () {
    loadScript('./eap-word-sheet-ui-authority-v285.js?v=20260731-v288-sheet-single-state-1', 'eap-v288', '__EAP_WORD_V288_SHEET_SINGLE_STATE__', function () {
      console.info('[EAP Word Quest] V288 Sheet single-state authority loaded', { bootstrap: VERSION });
    });
  }, 20);
  setTimeout(function () {
    loadScript('./eap-word-name-selection-persist-v287.js?v=20260731-v287-name-selection-persist-2', 'eap-v287', '__EAP_WORD_NAME_SELECTION_PERSIST_V287__');
  }, 35);
  setTimeout(function () {
    loadScript('./eap-word-authority-v275.js?v=20260731-v275-2', 'eap-v275', '__EAP_WORD_AUTHORITY_V275__', null, showAuthorityLoadError);
  }, 80);
  setTimeout(function () {
    loadScript('./eap-word-name-fallback-v276.js?v=20260731-v283-2', 'eap-v283', '__EAP_WORD_NAME_FALLBACK_V276__');
  }, 200);
  setTimeout(function () {
    loadScript('./eap-word-name-mobile-retry-v282.js?v=20260731-v282-2', 'eap-v282', '__EAP_WORD_NAME_MOBILE_RETRY_V282__');
  }, 400);
  setTimeout(function () {
    loadScript('./eap-word-identity-proof-v278.js?v=20260731-v278-2', 'eap-v278', '__EAP_WORD_IDENTITY_PROOF_V278__');
  }, 600);
  setTimeout(function () {
    loadScript('./eap-word-engine-v280-compact-submit.js?v=20260731-v280-2', 'eap-v280', '__EAP_WORD_V280_COMPACT_SUBMIT__');
  }, 940);
  setTimeout(function () {
    loadScript('./eap-word-mobile-next-v284.js?v=20260731-v284-2', 'eap-v284', '__EAP_WORD_MOBILE_NEXT_V284__');
  }, 1080);

  console.info('[EAP Word Quest] compatibility bootstrap ready', { version: VERSION });
})();
