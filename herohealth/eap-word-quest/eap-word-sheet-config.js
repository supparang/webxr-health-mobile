/* EAP Word Quest • Shared Sheets Configuration • Group 122 */
(() => {
  "use strict";

  const existing = window.EAP_WORD_SHEET_CONFIG || {};
  const savedEndpoint = (() => {
    try { return localStorage.getItem("EAP_WORD_SHEET_ENDPOINT") || ""; }
    catch (err) { return ""; }
  })();

  window.EAP_WORD_SHEET_CONFIG = Object.assign({
    endpoint: "https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec",
    group: "122",
    course: "EAP Word Quest",
    appVersion: "v2.5.2"
  }, existing);

  if (!window.EAP_WORD_SHEET_CONFIG.endpoint && savedEndpoint) {
    window.EAP_WORD_SHEET_CONFIG.endpoint = savedEndpoint;
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

  function loadTeacherRuntime(file, tag) {
    if (document.querySelector(`script[data-eap-teacher-runtime="${tag}"]`)) return;
    const script = document.createElement("script");
    script.src = `./${file}?v=20260630-${tag}`;
    script.async = false;
    script.dataset.eapTeacherRuntime = tag;
    document.head.appendChild(script);
  }

  const isTeacher = /\/teacher\.html$/i.test(location.pathname || "");

  if (!isTeacher) {
    loadRuntime("eap-word-engine-v240-core-cloud-sync.js", "core-cloud-sync-v252");
  }

  loadRuntime("eap-word-engine-v245-profile-identity-sync.js", "profile-identity-sync-v252");

  if (isTeacher) {
    loadTeacherRuntime("eap-word-teacher-v242-loader.js", "v251-loader-v252");
    loadTeacherRuntime("eap-word-teacher-v246-identity-name-truth.js", "v246-identity-name-truth-v252");
    loadTeacherRuntime("eap-word-teacher-v252-cloud-ledger-integrity.js", "v252-cloud-ledger-integrity");
  }
})();
