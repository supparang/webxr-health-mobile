/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   File kept as v262 because older cached index.html already loads this path.

   Version: 20260728-V274-NO-DOM-OBSERVER-BOOTSTRAP
   - Disable the former observer-based Authority client.
   - Load lightweight Sheet Authority V274 immediately.
   - Keep the exact-summary Sheet sender.
   - Show a visible diagnostic if Authority cannot load.
========================================================= */
(function () {
  "use strict";

  var VERSION = "20260728-V274-NO-DOM-OBSERVER-BOOTSTRAP";
  var AUTH_TAG = "eap-word-authority-v274-bootstrap";
  var SUMMARY_TAG = "exact-summary-sheet-submit-v271";

  if (window.__EAP_WORD_V274_BOOTSTRAP__) return;
  window.__EAP_WORD_V274_BOOTSTRAP__ = true;

  /* Critical: cached index pages may still load the former V272 file later. */
  window.__EAP_WORD_AUTHORITY_V272__ = true;

  function afterDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function showAuthorityLoadError() {
    afterDomReady(function () {
      var panel = document.getElementById("eapWordAuthorityPanel");
      var status;
      var profileButton;
      var host;
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "eapWordAuthorityPanel";
        panel.setAttribute("aria-live", "polite");
        panel.style.cssText = "margin-top:12px;padding:13px 15px;border:1px solid #fecaca;border-radius:15px;background:#fff1f2;color:#b42318;font-weight:750;line-height:1.45";
        status = document.getElementById("profileStatus");
        if (status && status.parentNode) {
          status.parentNode.insertBefore(panel, status.nextSibling);
        } else {
          profileButton = document.getElementById("saveProfileBtn");
          host = profileButton && profileButton.closest ? profileButton.closest(".panel") : document.body;
          host.appendChild(panel);
        }
      }
      panel.textContent = "โหลดระบบยืนยันตัวตนจาก Google Sheet ไม่สำเร็จ กรุณาปิดแท็บนี้แล้วเปิดลิงก์ทดสอบ V274 ใหม่";
    });
  }

  function loadAuthority() {
    var script;
    if (
      window.__EAP_WORD_AUTHORITY_V274__ ||
      document.querySelector('script[data-eap-runtime="' + AUTH_TAG + '"]')
    ) {
      return;
    }

    script = document.createElement("script");
    script.src = "./eap-word-authority-v274.js?v=20260728-v274-no-observer-2";
    script.async = false;
    script.setAttribute("data-eap-runtime", AUTH_TAG);
    script.onload = function () {
      console.info("[EAP Word Quest] lightweight Sheet Authority loaded", {
        bootstrap: VERSION
      });
    };
    script.onerror = function () {
      console.error("[EAP Word Quest] lightweight Sheet Authority could not load", {
        bootstrap: VERSION,
        src: script.src
      });
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

    script = document.createElement("script");
    script.src = "./eap-word-engine-v271-exact-summary-sheet-submit.js?v=20260701-exact-summary-v271";
    script.async = false;
    script.setAttribute("data-eap-runtime", SUMMARY_TAG);
    script.onerror = function () {
      console.warn("[EAP Word Quest] exact summary Sheets sender could not load");
    };
    document.head.appendChild(script);
  }

  /* Authority starts immediately and blocks play until Sheet verification. */
  loadAuthority();

  /* Attach the existing result sender after core/logger settle. */
  setTimeout(loadExactSummarySender, 700);

  console.info("[EAP Word Quest] compatibility bootstrap ready", {
    version: VERSION
  });
})();
