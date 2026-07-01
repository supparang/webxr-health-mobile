/* =========================================================
   EAP Word Quest • Sync Compatibility Loader
   File kept as v262 because index.html already loads this path.

   The old v262 queue/observer bridge has been retired. This loader starts
   only the small v270 direct-summary sender after the student page boots.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.7.0-COMPAT-LOADER-122";
  const TAG = "direct-sheet-submit-v270";

  if (window.__EAP_WORD_V270_COMPAT_LOADER__) return;
  window.__EAP_WORD_V270_COMPAT_LOADER__ = true;

  function load() {
    if (
      window.__EAP_WORD_V270_DIRECT_SHEET_SUBMIT__ ||
      document.querySelector(`script[data-eap-runtime="${TAG}"]`)
    ) {
      return;
    }

    const script = document.createElement("script");
    script.src = "./eap-word-engine-v270-direct-sheet-submit.js?v=20260701-direct-sheet-submit-v270";
    script.async = false;
    script.dataset.eapRuntime = TAG;
    script.onerror = () => {
      console.warn("[EAP Word Quest] direct Sheets sender could not load");
    };
    document.head.appendChild(script);
  }

  /* Wait until the core, logger, and v224 storage recovery have completed. */
  setTimeout(load, 700);

  console.info("[EAP Word Quest] stable direct Sheets compatibility loader ready", {
    version: VERSION
  });
})();
