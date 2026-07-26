/* CSAI2601 UX Quest • Mission Control Review Action v1
 * Completed 3/3 nodes open a read-only Studio & Reflection review.
 */
(() => {
  'use strict';

  const VERSION = '20260726-MISSION-CONTROL-REVIEW-ACTION-V1';
  const params = new URLSearchParams(location.search || '');
  const clean = value => String(value == null ? '' : value).trim();

  function nodeIdFromCard(card) {
    return clean(card?.dataset?.nodeId || card?.dataset?.node ||
      card?.querySelector?.('[data-node-id]')?.dataset?.nodeId || '').toLowerCase();
  }

  function reviewUrl(id) {
    const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
    url.searchParams.set('node', id.toUpperCase());
    url.searchParams.set('review', '1');
    url.searchParams.set('v', 'studio-reflection-review-v1-20260726');
    ['studentId','studentName','section','classroom','courseId','sheet','api','sid','name','device'].forEach(key => {
      const value = params.get(key);
      if (value) url.searchParams.set(key, value);
    });
    return url.href;
  }

  function isComplete(card) {
    if (!card) return false;
    if (card.dataset.nodeComplete === '1') return true;
    const badge = clean(card.querySelector('.stage-state')?.textContent);
    const status = clean(card.querySelector('.studio-node-status')?.textContent);
    return /complete\s*3\s*\/\s*3/i.test(badge) ||
      (/mission\s*✓/i.test(status) && /studio\s*✓/i.test(status) && /reflection\s*✓/i.test(status));
  }

  function apply() {
    document.querySelectorAll('.campaign-preview,[data-node-id],[data-node]').forEach(card => {
      if (!isComplete(card)) return;
      const id = nodeIdFromCard(card);
      if (!/^(w(?:[1-9]|1[0-5])|b[1-4])$/.test(id)) return;
      const launch = card.querySelector('.campaign-launch');
      if (!launch) return;
      const href = reviewUrl(id);
      if (launch.textContent.trim() !== 'ดู Studio & Reflection') launch.textContent = 'ดู Studio & Reflection';
      if (launch.href !== href) launch.href = href;
      launch.setAttribute('aria-label', `ดู Studio Practice และ Weekly Reflection ของ ${id.toUpperCase()}`);
      launch.setAttribute('aria-disabled', 'false');
      launch.onclick = null;
    });
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['data-node-complete'] });
  setTimeout(() => observer.disconnect(), 20000);
  window.addEventListener('uxq-studio-status-updated', schedule);
  window.UXQMissionControlReviewActionV1 = Object.freeze({ version:VERSION, apply });
})();
