/* CSAI2601 UX Quest • Preview Result Final Authority v1
 * Preview-only, idempotent cleanup for mission result UI.
 * Removes official score/pass copy and keeps exactly one QA replay action.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const preview = params.get('contentPreview') === '1' || /^content-preview-/i.test(params.get('v') || '');
  if (!preview) return;

  const QA_TEXT = 'ตรวจ Case ใหม่ →';
  let applying = false;

  function textOf(el) {
    return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findResultRegion(root) {
    return root.querySelector('.result-card,.completion-card,.mission-result,.result-summary,[data-result],[data-mission-result]') || root;
  }

  function cleanOfficialResultCopy(region) {
    region.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const text = textOf(el);
      if (/^ผ่านแล้ว[:：]?|คะแนนดีที่สุด|best score|canonicalPassedMissionIds/i.test(text)) {
        el.remove();
      }
    });
  }

  function normalizeReplayActions(region) {
    const candidates = [...region.querySelectorAll('a,button')].filter(el => {
      const text = textOf(el);
      return /เล่นซ้ำเพื่อฝึก|ตรวจ Case ใหม่|replay|retry/i.test(text);
    });

    if (!candidates.length) return;

    const primary = candidates[0];
    primary.textContent = QA_TEXT;
    primary.dataset.uxqPreviewReplay = '1';
    primary.setAttribute('aria-label', 'ตรวจ Case ใหม่ในโหมด Content Preview');

    candidates.slice(1).forEach(el => el.remove());

    // Defensive cleanup for duplicate wrappers created by legacy observers.
    region.querySelectorAll('[data-uxq-preview-replay="1"]').forEach((el, index) => {
      if (index > 0) el.remove();
    });
  }

  function removeOrphanDuplicates(root) {
    const duplicateLeaves = [...root.querySelectorAll('a,button,div,p,span')]
      .filter(el => el.children.length === 0 && textOf(el) === QA_TEXT);
    duplicateLeaves.slice(1).forEach(el => {
      const wrapper = el.closest('a,button') || el;
      wrapper.remove();
    });
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      const root = document.getElementById('uxqCanonicalNode') || document.body;
      const region = findResultRegion(root);
      cleanOfficialResultCopy(region);
      normalizeReplayActions(region);
      removeOrphanDuplicates(root);
      root.dataset.uxqPreviewResultClean = '1';
    } finally {
      applying = false;
    }
  }

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once:true });
  else queue();

  new MutationObserver(queue).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('pageshow', queue);

  window.UXQPreviewResultFinalAuthority = Object.freeze({
    version:'20260728-PREVIEW-RESULT-FINAL-V1',
    refresh:queue
  });
})();