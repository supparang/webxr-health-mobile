/* =========================================================
   EAP Word Quest • Sync Compatibility Loader
   File kept as v262 because index.html already loads this path.

   v2.7.1 loads one direct sender that builds the payload ONLY from the
   currently visible v172 summary state. It never reuses a prior round log.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.7.1-EXACT-SUMMARY-COMPAT-LOADER-122";
  const TAG = "exact-summary-sheet-submit-v271";

  if (window.__EAP_WORD_V271_COMPAT_LOADER__) return;
  window.__EAP_WORD_V271_COMPAT_LOADER__ = true;

  function load() {
    if (
      window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ ||
      document.querySelector(`script[data-eap-runtime="${TAG}"]`)
    ) {
      return;
    }

    const script = document.createElement("script");
    script.src = "./eap-word-engine-v271-exact-summary-sheet-submit.js?v=20260701-exact-summary-v271";
    script.async = false;
    script.dataset.eapRuntime = TAG;
    script.onerror = () => {
      console.warn("[EAP Word Quest] exact summary Sheets sender could not load");
    };
    document.head.appendChild(script);
  }

  /* Wait until core, logger and v224 storage recovery have settled. */
  setTimeout(load, 700);

  console.info("[EAP Word Quest] exact summary Sheets loader ready", {
    version: VERSION
  });
})();
