/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   Version: 20260801-V297-ANALYTICS-PAYLOAD-BOOTSTRAP
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260801-V297-ANALYTICS-PAYLOAD-BOOTSTRAP';
  if (window.__EAP_WORD_V297_BOOTSTRAP__) return;
  window.__EAP_WORD_V297_BOOTSTRAP__ = true;
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

  loadScript('./eap-word-profile-actions-stability-v289.js?v=20260731-v291-stable-profile-proxy-1', 'eap-v291', '__EAP_WORD_PROFILE_ACTIONS_STABILITY_V291__');
  loadScript('./eap-word-sheet-resume-rehydrate-v281.js?v=20260731-v281-3', 'eap-v281', '__EAP_WORD_V281_SHEET_REHYDRATE__');
  loadScript('./eap-word-summary-cta-authority-v292.js?v=20260731-v294-live-summary-actions-1', 'eap-v294', '__EAP_WORD_SUMMARY_ACTIONS_V294__');
  loadScript('./eap-word-final-completion-authority-v295.js?v=20260731-v295-final-completion-1', 'eap-v295', '__EAP_WORD_FINAL_COMPLETION_V295__');
  loadScript('./eap-word-home-completion-report-v296.js?v=20260731-v296-home-report-polish-1', 'eap-v296', '__EAP_WORD_HOME_REPORT_V296__');

  setTimeout(function () {
    loadScript('./eap-word-sheet-ui-authority-v285.js?v=20260731-v290-no-reload-1', 'eap-v290', '__EAP_WORD_V290_NO_RELOAD_SINGLE_STATE__', function () {
      console.info('[EAP Word Quest] V290 no-reload Sheet authority loaded', { bootstrap: VERSION });
    });
  }, 20);
  setTimeout(function () {
    loadScript('./eap-word-name-selection-persist-v287.js?v=20260731-v287-name-selection-persist-3', 'eap-v287', '__EAP_WORD_NAME_SELECTION_PERSIST_V287__');
  }, 35);
  setTimeout(function () {
    loadScript('./eap-word-authority-v275.js?v=20260731-v275-3', 'eap-v275', '__EAP_WORD_AUTHORITY_V275__', null, showAuthorityLoadError);
  }, 80);
  setTimeout(function () {
    loadScript('./eap-word-name-fallback-v276.js?v=20260731-v283-3', 'eap-v283', '__EAP_WORD_NAME_FALLBACK_V276__');
  }, 200);
  setTimeout(function () {
    loadScript('./eap-word-name-mobile-retry-v282.js?v=20260731-v282-3', 'eap-v282', '__EAP_WORD_NAME_MOBILE_RETRY_V282__');
  }, 400);
  setTimeout(function () {
    loadScript('./eap-word-identity-proof-v278.js?v=20260731-v278-3', 'eap-v278', '__EAP_WORD_IDENTITY_PROOF_V278__');
  }, 600);
  setTimeout(function () {
    loadScript('./eap-word-analytics-payload-v297.js?v=20260801-v297-analytics-payload-1', 'eap-v297', '__EAP_WORD_V297_ANALYTICS_PAYLOAD__');
  }, 820);
  setTimeout(function () {
    loadScript('./eap-word-engine-v280-compact-submit.js?v=20260801-v297-analytics-payload-1', 'eap-v280', '__EAP_WORD_V280_COMPACT_SUBMIT__');
  }, 940);
  setTimeout(function () {
    loadScript('./eap-word-mobile-next-v284.js?v=20260731-v284-3', 'eap-v284', '__EAP_WORD_MOBILE_NEXT_V284__');
  }, 1080);

  console.info('[EAP Word Quest] compatibility bootstrap ready', { version: VERSION });
})();