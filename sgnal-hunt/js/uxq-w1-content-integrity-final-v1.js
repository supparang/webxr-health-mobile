/* CSAI2601 UX Quest • W1 Content Integrity Compatibility Stub v1.2
 * RETIRED DOM REWRITER — 2026-08-13
 *
 * The canonical visible-content owner is now
 * `uxq-canonical-content-final-authority-v3.js`.
 *
 * Older revisions of this file continuously rewrote W1 prompt/choice/reason
 * text with a MutationObserver. When the canonical final authority was also
 * active, both authorities alternated DOM text and caused visible shaking.
 *
 * This compatibility file intentionally performs no learner-facing DOM writes
 * and installs no MutationObserver. It remains at the legacy path so existing
 * HTML load order and cached references do not fail.
 */
(() => {
  'use strict';

  const VERSION = '20260813-W1-CONTENT-INTEGRITY-RETIRED-V1.2';
  const params = new URLSearchParams(location.search || '');
  const node = String(params.get('node') || params.get('id') || 'W1').toUpperCase();
  if (node !== 'W1') return;

  document.documentElement.dataset.uxqW1ContentIntegrity = 'retired-canonical-final-v3-owner';

  window.UXQW1ContentIntegrityFinal = Object.freeze({
    version: VERSION,
    retired: true,
    owner: 'CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3',
    apply() {
      try {
        window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3?.run?.();
      } catch (_) {}
    }
  });
})();
