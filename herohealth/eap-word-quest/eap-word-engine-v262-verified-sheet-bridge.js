/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   File kept as v262 because older cached index.html already loads this path.

   Version: 20260729-V280-COMPACT-SUBMIT-BOOTSTRAP
   - Load V275 Google Sheet authority.
   - Load V276 official-name fallback.
   - Load V278 runtime identity proof before submit.
   - Load V280 compact JSONP submit with longer timeout.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-V280-COMPACT-SUBMIT-BOOTSTRAP';
  var AUTH_TAG = 'eap-word-authority-v275-bootstrap';
  var NAME_TAG = 'eap-word-name-fallback-v276-bootstrap';
  var PROOF_TAG = 'eap-word-identity-proof-v278-bootstrap';
  var SUBMIT_TAG = 'eap-word-v280-compact-bootstrap';

  if (window.__EAP_WORD_V280_BOOTSTRAP__) return;
  window.__EAP_WORD_V280_BOOTSTRAP__ = true;
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

  loadAuthority();
  setTimeout(loadNameFallback,120);
  setTimeout(loadIdentityProof,430);
  setTimeout(loadCompactSubmit,760);
  console.info('[EAP Word Quest] compatibility bootstrap ready',{version:VERSION});
})();