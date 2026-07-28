/* =========================================================
   EAP Word Quest • Compatibility Bootstrap Loader
   File kept as v262 because older cached index.html already loads this path.

   Version: 20260728-V273-AUTHORITY-BOOTSTRAP
   - Load Sheet Authority client immediately.
   - Keep the exact-summary Sheet sender.
   - Show a visible diagnostic if the Authority client cannot load.
========================================================= */
(function () {
  "use strict";

  var VERSION = "20260728-V273-AUTHORITY-BOOTSTRAP";
  var AUTH_TAG = "eap-word-authority-v273-bootstrap";
  var SUMMARY_TAG = "exact-summary-sheet-submit-v271";

  if (window.__EAP_WORD_V273_BOOTSTRAP__) return;
  window.__EAP_WORD_V273_BOOTSTRAP__ = true;

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
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "eapWordAuthorityPanel";
        panel.setAttribute("aria-live", "polite");
        panel.style.cssText = "margin-top:12px;padding:13px 15px;border:1px solid #fecaca;border-radius:15px;background:#fff1f2;color:#b42318;font-weight:750;line-height:1.45";
        var status = document.getElementById("profileStatus");
        if (status && status.parentNode) {
          status.parentNode.insertBefore(panel, status.nextSibling);
        } else {
          var profileButton = document.getElementById("saveProfileBtn");
          var host = profileButton && profileButton.closest ? profileButton.closest(".panel") : document.body;
          host.appendChild(panel);
        }
      }
      panel.textContent = "โหลดระบบยืนยันตัวตนจาก Google Sheet ไม่สำเร็จ กรุณากด Ctrl+F5 แล้วลองใหม่";
    });
  }

  function loadAuthority() {
    if (
      window.__EAP_WORD_AUTHORITY_V272__ ||
      document.querySelector('script[data-eap-runtime="' + AUTH_TAG + '"]')
    ) {
      return;
    }

    var script = document.createElement("script");
    script.src = "./eap-word-authority-v272.js?v=20260728-v273-bootstrap-1";
    script.async = false;
    script.setAttribute("data-eap-runtime", AUTH_TAG);
    script.onload = function () {
      console.info("[EAP Word Quest] Sheet Authority client loaded", {
        bootstrap: VERSION
      });
    };
    script.onerror = function () {
      console.error("[EAP Word Quest] Sheet Authority client could not load", {
        bootstrap: VERSION,
        src: script.src
      });
      showAuthorityLoadError();
    };
    document.head.appendChild(script);
  }

  function loadExactSummarySender() {
    if (
      window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ ||
      document.querySelector('script[data-eap-runtime="' + SUMMARY_TAG + '"]')
    ) {
      return;
    }

    var script = document.createElement("script");
    script.src = "./eap-word-engine-v271-exact-summary-sheet-submit.js?v=20260701-exact-summary-v271";
    script.async = false;
    script.setAttribute("data-eap-runtime", SUMMARY_TAG);
    script.onerror = function () {
      console.warn("[EAP Word Quest] exact summary Sheets sender could not load");
    };
    document.head.appendChild(script);
  }

  /* Authority must start immediately; it blocks play until Sheet verification. */
  loadAuthority();

  /* Wait until core/logger/storage-recovery settle before attaching summary sender. */
  setTimeout(loadExactSummarySender, 700);

  console.info("[EAP Word Quest] compatibility bootstrap ready", {
    version: VERSION
  });
})();
