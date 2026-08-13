/* CSAI2601 UX Quest • Canonical Final Authority Bootstrap v3
 * This legacy filename remains in the production HTML for compatibility.
 * It now loads the canonical all-19 final content authority with a fresh cache key.
 */
(() => {
  'use strict';
  const VERSION = '20260813-CANONICAL-FINAL-BOOTSTRAP-V3';
  if (window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3) {
    window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3.activateVisible();
    window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3.run();
    return;
  }
  if (document.querySelector('script[data-uxq-canonical-final-v3]')) return;
  const script = document.createElement('script');
  script.src = './js/uxq-canonical-content-final-authority-v3.js?v=content-alignment-v3-20260813';
  script.async = false;
  script.dataset.uxqCanonicalFinalV3 = VERSION;
  script.onload = () => {
    document.documentElement.dataset.uxqCanonicalFinalBootstrap = 'loaded';
    window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3?.activateVisible?.();
    window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3?.run?.();
  };
  script.onerror = () => {
    document.documentElement.dataset.uxqCanonicalFinalBootstrap = 'load-error';
    console.error('[CSAI2601] canonical final authority failed to load');
  };
  document.head.appendChild(script);
})();