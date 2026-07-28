/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   File kept as v262 because older cached index.html already loads this path.

   Version: 20260728-V275-VERIFICATION-PROOF-BOOTSTRAP
   - Disable retired V272/V274 clients.
   - Load V275 verification-proof client immediately.
   - Keep the exact-summary Sheet sender.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260728-V275-VERIFICATION-PROOF-BOOTSTRAP';
  var AUTH_TAG = 'eap-word-authority-v275-bootstrap';
  var SUMMARY_TAG = 'exact-summary-sheet-submit-v271';

  if (window.__EAP_WORD_V275_BOOTSTRAP__) return;
  window.__EAP_WORD_V275_BOOTSTRAP__ = true;
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
      panel.textContent = 'โหลดระบบยืนยันตัวตน V275 ไม่สำเร็จ กรุณาปิดแท็บแล้วเปิดหน้าใหม่';
    });
  }

  function loadAuthority() {
    var script;
    if (
      window.__EAP_WORD_AUTHORITY_V275__ ||
      document.querySelector('script[data-eap-runtime="' + AUTH_TAG + '"]')
    ) {
      return;
    }
    script = document.createElement('script');
    script.src = './eap-word-authority-v275.js?v=20260728-v275-proof-1';
    script.async = false;
    script.setAttribute('data-eap-runtime',AUTH_TAG);
    script.onload = function () {
      console.info('[EAP Word Quest] V275 Sheet Authority loaded',{bootstrap:VERSION});
    };
    script.onerror = function () {
      console.error('[EAP Word Quest] V275 Sheet Authority could not load',{bootstrap:VERSION,src:script.src});
      showAuthorityLoadError();
    };
    document.head.appendChild(script);
  }

  function loadExactSummarySender() {
    var script;
    if (
      window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ ||
      document.querySelector('script[data-eap-runtime="' + SUMMARY_TAG + '"]')
    ) {
      return;
    }
    script = document.createElement('script');
    script.src = './eap-word-engine-v271-exact-summary-sheet-submit.js?v=20260701-exact-summary-v271';
    script.async = false;
    script.setAttribute('data-eap-runtime',SUMMARY_TAG);
    script.onerror = function () {
      console.warn('[EAP Word Quest] exact summary Sheets sender could not load');
    };
    document.head.appendChild(script);
  }

  loadAuthority();
  setTimeout(loadExactSummarySender,700);
  console.info('[EAP Word Quest] compatibility bootstrap ready',{version:VERSION});
})();
