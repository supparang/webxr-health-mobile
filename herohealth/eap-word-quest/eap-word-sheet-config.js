/* =========================================================
   EAP Word Quest • Shared Sheets Configuration
   File: /herohealth/eap-word-quest/eap-word-sheet-config.js

   Group 122 Google Apps Script Web App endpoint.
========================================================= */
(() => {
  "use strict";

  const existing = window.EAP_WORD_SHEET_CONFIG || {};
  const endpointFromStorage = (() => {
    try { return localStorage.getItem("EAP_WORD_SHEET_ENDPOINT") || ""; }
    catch (err) { return ""; }
  })();

  window.EAP_WORD_SHEET_CONFIG = Object.assign({
    endpoint: "https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec",
    group: "122",
    course: "EAP Word Quest",
    appVersion: "v2.4.1"
  }, existing);

  /* A previously saved teacher-side endpoint may be retained only when a
     deployment URL was explicitly configured in the current browser. */
  if (!window.EAP_WORD_SHEET_CONFIG.endpoint && endpointFromStorage) {
    window.EAP_WORD_SHEET_CONFIG.endpoint = endpointFromStorage;
  }

  window.getEapWordSheetEndpoint = () => String(
    (window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint) || ""
  ).trim();

  // teacher.html needs the Core pass ledger as its local source of truth.
  // The loader waits until report-core and teacher render handlers are ready.
  if (/\/teacher\.html$/i.test(location.pathname || "")) {
    const loaded = document.querySelector('script[data-eap-teacher-runtime="v242-loader"]');
    if (!loaded) {
      const script = document.createElement("script");
      script.src = "./eap-word-teacher-v242-loader.js?v=20260630-v242-loader";
      script.async = false;
      script.dataset.eapTeacherRuntime = "v242-loader";
      document.head.appendChild(script);
    }
  }
})();
