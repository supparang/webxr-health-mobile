/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   File kept as v262 because older cached index.html already loads this path.

   Version: 20260729-V285-SHEET-UI-AUTHORITY-BOOTSTRAP
   - Load V281 before Authority so it can catch the resume-ready event.
   - Load V285 before Authority so Home stats/CTA use Sheet resume directly.
   - Load V275 Google Sheet authority.
   - Load V276/V283 official-name fallback.
   - Load V282 mobile name lookup retry/error separation.
   - Load V278 runtime identity proof before submit.
   - Load V280 compact JSONP submit with longer timeout.
   - Load V284 mobile next-question guard.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-V285-SHEET-UI-AUTHORITY-BOOTSTRAP';
  var REHYDRATE_TAG = 'eap-word-v281-sheet-rehydrate-bootstrap';
  var SHEET_UI_TAG = 'eap-word-v285-sheet-ui-authority-bootstrap';
  var AUTH_TAG = 'eap-word-authority-v275-bootstrap';
  var NAME_TAG = 'eap-word-name-fallback-v276-bootstrap';
  var NAME_MOBILE_TAG = 'eap-word-name-mobile-retry-v282-bootstrap';
  var PROOF_TAG = 'eap-word-identity-proof-v278-bootstrap';
  var SUBMIT_TAG = 'eap-word-v280-compact-bootstrap';
  var MOBILE_NEXT_TAG = 'eap-word-mobile-next-v284-bootstrap';

  if (window.__EAP_WORD_V285_BOOTSTRAP__) return;
  window.__EAP_WORD_V285_BOOTSTRAP__ = true;
  window.__EAP_WORD_AUTHORITY_V272__ = true;
  window.__EAP_WORD_AUTHORITY_V274__ = true;

  function afterDomReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',callback,{once:true});
    else callback();
  }

  function showAuthorityLoadError() {
    afterDomReady(function () {
      var panel = document.getElementById('eapWordAuthorityPanel');
      var status;
      var profileButton;
      var host;
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'eapWordAuthorityPanel';
        panel.setAttribute('aria-live','polite');
        panel.style.cssText = 'margin-top:12px;padding:13px 15px;border:1px solid #fecaca;border-radius:15px;background:#fff1f2;color:#b42318;font-weight:750;line-height:1.45';
        status = document.getElementById('profileStatus');
        if (status && status.parentNode) status.parentNode.insertBefore(panel,status.nextSibling);
        else {
          profileButton = document.getElementById('saveProfileBtn');
          host = profileButton && profileButton.closest ? profileButton.closest('.panel') : document.body;
          host.appendChild(panel);
        }
      }
      panel.textContent = 'โหลดระบบยืนยันตัวตนไม่สำเร็จ กรุณาปิดแท็บแล้วเปิดหน้าใหม่';
    });
  }

  function loadScript(src,tag,guard,onload,onerror) {
    var script;
    if (window[guard]) return;
    if (document.querySelector('script[data-eap-runtime="' + tag + '"]')) return;
    script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute('data-eap-runtime',tag);
    if (onload) script.onload = onload;
    if (onerror) script.onerror = onerror;
    document.head.appendChild(script);
  }

  function loadSheetRehydrate() {
    loadScript('./eap-word-sheet-resume-rehydrate-v281.js?v=20260729-v281-sheet-rehydrate-1',REHYDRATE_TAG,'__EAP_WORD_V281_SHEET_REHYDRATE__',function () {
      console.info('[EAP Word Quest] V281 Sheet rehydrate loaded',{bootstrap:VERSION});
    });
  }

  function loadSheetUiAuthority() {
    loadScript('./eap-word-sheet-ui-authority-v285.js?v=20260729-v285-sheet-ui-authority-1',SHEET_UI_TAG,'__EAP_WORD_V285_SHEET_UI_AUTHORITY__',function () {
      console.info('[EAP Word Quest] V285 Sheet UI authority loaded',{bootstrap:VERSION});
    },function () {
      console.error('[EAP Word Quest] V285 Sheet UI authority could not load',{bootstrap:VERSION});
    });
  }

  function loadAuthority() {
    loadScript('./eap-word-authority-v275.js?v=20260728-v275-proof-1',AUTH_TAG,'__EAP_WORD_AUTHORITY_V275__',function () {
      console.info('[EAP Word Quest] V275 Sheet Authority loaded',{bootstrap:VERSION});
    },function () {
      console.error('[EAP Word Quest] V275 Sheet Authority could not load',{bootstrap:VERSION});
      showAuthorityLoadError();
    });
  }

  function loadNameFallback() {
    loadScript('./eap-word-name-fallback-v276.js?v=20260729-v283-mobile-direct-1',NAME_TAG,'__EAP_WORD_NAME_FALLBACK_V276__',function () {
      console.info('[EAP Word Quest] V276/V283 official-name fallback loaded',{bootstrap:VERSION});
    });
  }

  function loadMobileNameRetry() {
    loadScript('./eap-word-name-mobile-retry-v282.js?v=20260729-v282-mobile-name-retry-1',NAME_MOBILE_TAG,'__EAP_WORD_NAME_MOBILE_RETRY_V282__');
  }

  function loadIdentityProof() {
    loadScript('./eap-word-identity-proof-v278.js?v=20260728-v278-runtime-proof-1',PROOF_TAG,'__EAP_WORD_IDENTITY_PROOF_V278__');
  }

  function loadCompactSubmit() {
    loadScript('./eap-word-engine-v280-compact-submit.js?v=20260729-v280-compact-submit-1',SUBMIT_TAG,'__EAP_WORD_V280_COMPACT_SUBMIT__');
  }

  function loadMobileNext() {
    loadScript('./eap-word-mobile-next-v284.js?v=20260729-v284-mobile-next-1',MOBILE_NEXT_TAG,'__EAP_WORD_MOBILE_NEXT_V284__');
  }

  loadSheetRehydrate();
  setTimeout(loadSheetUiAuthority,20);
  setTimeout(loadAuthority,60);
  setTimeout(loadNameFallback,180);
  setTimeout(loadMobileNameRetry,380);
  setTimeout(loadIdentityProof,580);
  setTimeout(loadCompactSubmit,920);
  setTimeout(loadMobileNext,1060);
  console.info('[EAP Word Quest] compatibility bootstrap ready',{version:VERSION});
})();
