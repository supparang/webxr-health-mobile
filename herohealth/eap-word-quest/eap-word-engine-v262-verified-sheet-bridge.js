/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   File kept as v262 because older cached index.html already loads this path.

   Version: 20260729-V282-MOBILE-NAME-RETRY-BOOTSTRAP
   - Load V281 before Authority so it can catch the resume-ready event.
   - Load V275 Google Sheet authority.
   - Load V276 official-name fallback.
   - Load V282 mobile name lookup retry/error separation.
   - Load V278 runtime identity proof before submit.
   - Load V280 compact JSONP submit with longer timeout.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-V282-MOBILE-NAME-RETRY-BOOTSTRAP';
  var REHYDRATE_TAG = 'eap-word-v281-sheet-rehydrate-bootstrap';
  var AUTH_TAG = 'eap-word-authority-v275-bootstrap';
  var NAME_TAG = 'eap-word-name-fallback-v276-bootstrap';
  var NAME_MOBILE_TAG = 'eap-word-name-mobile-retry-v282-bootstrap';
  var PROOF_TAG = 'eap-word-identity-proof-v278-bootstrap';
  var SUBMIT_TAG = 'eap-word-v280-compact-bootstrap';

  if (window.__EAP_WORD_V282_BOOTSTRAP__) return;
  window.__EAP_WORD_V282_BOOTSTRAP__ = true;
  window.__EAP_WORD_AUTHORITY_V272__ = true;
  window.__EAP_WORD_AUTHORITY_V274__ = true;

  function afterDomReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded',callback,{once:true});
    } else {
      callback();
    }
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
        if (status && status.parentNode) {
          status.parentNode.insertBefore(panel,status.nextSibling);
        } else {
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
    loadScript(
      './eap-word-sheet-resume-rehydrate-v281.js?v=20260729-v281-sheet-rehydrate-1',
      REHYDRATE_TAG,
      '__EAP_WORD_V281_SHEET_REHYDRATE__',
      function () { console.info('[EAP Word Quest] V281 Sheet rehydrate loaded',{bootstrap:VERSION}); },
      function () { console.error('[EAP Word Quest] V281 Sheet rehydrate could not load',{bootstrap:VERSION}); }
    );
  }

  function loadAuthority() {
    loadScript(
      './eap-word-authority-v275.js?v=20260728-v275-proof-1',
      AUTH_TAG,
      '__EAP_WORD_AUTHORITY_V275__',
      function () { console.info('[EAP Word Quest] V275 Sheet Authority loaded',{bootstrap:VERSION}); },
      function () { console.error('[EAP Word Quest] V275 Sheet Authority could not load',{bootstrap:VERSION}); showAuthorityLoadError(); }
    );
  }

  function loadNameFallback() {
    loadScript(
      './eap-word-name-fallback-v276.js?v=20260728-v276-name-fallback-1',
      NAME_TAG,
      '__EAP_WORD_NAME_FALLBACK_V276__',
      function () { console.info('[EAP Word Quest] V276 official-name fallback loaded',{bootstrap:VERSION}); },
      function () { console.error('[EAP Word Quest] V276 name fallback could not load',{bootstrap:VERSION}); }
    );
  }

  function loadMobileNameRetry() {
    loadScript(
      './eap-word-name-mobile-retry-v282.js?v=20260729-v282-mobile-name-retry-1',
      NAME_MOBILE_TAG,
      '__EAP_WORD_NAME_MOBILE_RETRY_V282__',
      function () { console.info('[EAP Word Quest] V282 mobile name retry loaded',{bootstrap:VERSION}); },
      function () { console.error('[EAP Word Quest] V282 mobile name retry could not load',{bootstrap:VERSION}); }
    );
  }

  function loadIdentityProof() {
    loadScript(
      './eap-word-identity-proof-v278.js?v=20260728-v278-runtime-proof-1',
      PROOF_TAG,
      '__EAP_WORD_IDENTITY_PROOF_V278__',
      function () { console.info('[EAP Word Quest] V278 runtime identity proof loaded',{bootstrap:VERSION}); },
      function () { console.error('[EAP Word Quest] V278 runtime identity proof could not load',{bootstrap:VERSION}); }
    );
  }

  function loadCompactSubmit() {
    loadScript(
      './eap-word-engine-v280-compact-submit.js?v=20260729-v280-compact-submit-1',
      SUBMIT_TAG,
      '__EAP_WORD_V280_COMPACT_SUBMIT__',
      function () { console.info('[EAP Word Quest] V280 compact submit loaded',{bootstrap:VERSION}); },
      function () { console.error('[EAP Word Quest] V280 compact submit could not load',{bootstrap:VERSION}); }
    );
  }

  loadSheetRehydrate();
  setTimeout(loadAuthority,40);
  setTimeout(loadNameFallback,160);
  setTimeout(loadMobileNameRetry,360);
  setTimeout(loadIdentityProof,560);
  setTimeout(loadCompactSubmit,900);
  console.info('[EAP Word Quest] compatibility bootstrap ready',{version:VERSION});
})();
