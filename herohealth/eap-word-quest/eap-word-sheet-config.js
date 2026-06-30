/* =========================================================
   EAP Word Quest • Shared Sheets Configuration
   File: /herohealth/eap-word-quest/eap-word-sheet-config.js

   Group 122 Google Apps Script Web App endpoint.
   This file also starts the automatic cloud sync and one-time history
   backfill so data created before Sheets was connected is not lost.
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
    appVersion: "v2.4.4"
  }, existing);

  if (!window.EAP_WORD_SHEET_CONFIG.endpoint && endpointFromStorage) {
    window.EAP_WORD_SHEET_CONFIG.endpoint = endpointFromStorage;
  }

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

  const isTeacher = /\/teacher\.html$/i.test(location.pathname || "");

  // Every student run is queued and posted to Sheets after completion.
  if (!isTeacher) {
    loadRuntime("eap-word-engine-v240-core-cloud-sync.js", "core-cloud-sync");
  }

  // Uses the verified Core pass ledger to transfer historic sessions once.
  // This runs on the Student page and, on the same browser, on Teacher too.
  loadRuntime("eap-word-engine-v243-core-history-backfill.js", "core-history-backfill");

  if (isTeacher) {
    // Preserve the local Core truth and readable individual report layout.
    if (!document.querySelector('script[data-eap-teacher-runtime="v242-loader"]')) {
      const patch = document.createElement("script");
      patch.src = "./eap-word-teacher-v242-loader.js?v=20260630-v242-loader";
      patch.async = false;
      patch.dataset.eapTeacherRuntime = "v242-loader";
      document.head.appendChild(patch);
    }

    // Immediately sends this browser's previously completed Core history
    // and reloads the Google Sheets view once the import is accepted.
    loadRuntime("eap-word-teacher-v244-local-history-sync.js", "teacher-local-history-sync");
  }
})();
