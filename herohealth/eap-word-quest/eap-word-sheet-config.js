/* =========================================================
   EAP Word Quest • Shared Google Sheets Configuration
   Group 122 • v2.6.0
========================================================= */
(() => {
  "use strict";

  const DEFAULT_ENDPOINT = "https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec";
  const existing = window.EAP_WORD_SHEET_CONFIG || {};
  const savedEndpoint = (() => {
    try { return localStorage.getItem("EAP_WORD_SHEET_ENDPOINT") || ""; }
    catch (err) { return ""; }
  })();
  const isTeacher = /\/teacher\.html$/i.test(location.pathname || "");

  // A saved, teacher-approved endpoint takes precedence over the repository default.
  window.EAP_WORD_SHEET_CONFIG = Object.assign({}, existing, {
    endpoint: String(existing.endpoint || savedEndpoint || DEFAULT_ENDPOINT).trim(),
    group: "122",
    course: "EAP Word Quest",
    appVersion: "v2.6.0"
  });

  window.getEapWordSheetEndpoint = () => String(
    (window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint) || ""
  ).trim();

  function loadRuntime(file, tag) {
    if (document.querySelector(`script[data-eap-runtime="${tag}"]`)) return;
    const script = document.createElement("script");
    script.src = `./${file}?v=20260630-${tag}`;
    script.async = false;
    script.dataset.eapRuntime = tag;
    document.head.appendChild(script);
  }

  // Teacher has a self-contained dashboard. Student gets the cloud ledger and
  // identity profile sync only; this avoids old teacher patch races.
  if (!isTeacher) {
    loadRuntime("eap-word-engine-v260-cloud-ledger-final.js", "cloud-ledger-v260");
    loadRuntime("eap-word-engine-v245-profile-identity-sync.js", "profile-identity-sync-v260");
  }
})();
