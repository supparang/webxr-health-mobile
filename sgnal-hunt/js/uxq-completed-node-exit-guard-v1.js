/* =========================================================
 * CSAI2601 UX Quest • Completed Node Exit Guard v1
 * Google Sheet / authoritative tracker decides completion.
 * A completed node exits to Mission Control by default.
 * Add replay=1 to intentionally practise the completed node.
 * ========================================================= */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const node = String(params.get('node') || '').trim().toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(node)) return;
  if (params.get('replay') === '1' || params.get('practice') === '1') return;

  let redirected = false;
  let observer = null;
  let timeoutId = 0;

  function isAuthoritativelyComplete() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (!tracker) return false;
    const count = String(tracker.querySelector('.uxq-3part__count')?.textContent || '');
    const doneCards = tracker.querySelectorAll('.uxq-3part__item[data-state="done"]').length;
    return /3\s*\/\s*3/.test(count) && doneCards === 3;
  }

  function missionControlUrl() {
    const target = new URL('./csai2601-mission-control.html', location.href);
    ['studentId','studentName','section','classroom','courseId','sheet','api','sid','name'].forEach(key => {
      const value = params.get(key);
      if (value) target.searchParams.set(key, value);
    });
    target.searchParams.set('completed', node);
    return target.href;
  }

  function check() {
    if (redirected || !isAuthoritativelyComplete()) return;
    redirected = true;
    if (observer) observer.disconnect();
    clearTimeout(timeoutId);
    location.replace(missionControlUrl());
  }

  function attach() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (!tracker) {
      timeoutId = window.setTimeout(attach, 250);
      return;
    }
    check();
    if (redirected) return;
    observer = new MutationObserver(check);
    observer.observe(tracker, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-state']
    });
    timeoutId = window.setTimeout(() => {
      if (observer) observer.disconnect();
    }, 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  } else {
    attach();
  }
})();
