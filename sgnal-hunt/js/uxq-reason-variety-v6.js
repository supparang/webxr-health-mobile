/* CSAI2601 UX Quest • Reason Variety v6.1
 * Retired DOM text rewriting.
 *
 * The canonical item banks already provide question-specific Reason Check
 * prompts, correct rationales, distractors, and scoring identifiers. Earlier
 * versions replaced those texts with a small shared category pool, causing
 * different W12 rounds (State, Microcopy, Recovery, etc.) to display the same
 * reasons. This compatibility file now preserves the authored item content.
 */
(() => {
  'use strict';

  const VERSION = 'v20260712-item-specific-reasons';

  function markVersion() {
    document.documentElement.dataset.uxqReasonVariety = VERSION;

    /* Remove only obsolete diagnostic wording left by an already-rendered
       legacy version. Do not alter prompts, choices, reasons, IDs, or scores. */
    document.querySelectorAll('.verify').forEach((box) => {
      delete box.dataset.reasonVarietyV6;
      const title = box.querySelector('h3');
      if (title && /^ตรวจเหตุผล\s*•\s*(?:W|B)\d+/i.test(title.textContent || '')) {
        title.textContent = 'ตรวจเหตุผล';
      }
      box.querySelectorAll('.option span').forEach((small) => {
        if (/^เหตุผลนี้(?:ตรงกับชนิดข้อ|ยังไม่พอพิสูจน์)/.test((small.textContent || '').trim())) {
          small.textContent = '';
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markVersion, { once: true });
  } else {
    markVersion();
  }

  new MutationObserver(() => markVersion()).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
