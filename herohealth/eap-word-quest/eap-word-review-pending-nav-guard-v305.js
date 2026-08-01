/* =========================================================
   EAP Word Quest • Review Pending Navigation Guard
   Version: 20260801-EAPWQ-V305-REVIEW-PENDING-NAV

   Hides the primary summary CTA while a Weak Words review is still
   waiting for its Google Sheet receipt, preventing a false next-
   session label from flashing before confirmation.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260801-EAPWQ-V305-REVIEW-PENDING-NAV';
  var observer = null;
  var scheduled = false;

  if (window.__EAP_WORD_V305_REVIEW_PENDING_NAV__) return;
  window.__EAP_WORD_V305_REVIEW_PENDING_NAV__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function reviewActive() {
    var value = null;
    try {
      if (typeof window.getEapWordReviewContextV301 === 'function') value = window.getEapWordReviewContextV301();
    } catch (ignore) {}
    return Boolean(value && value.active);
  }

  function receiptConfirmed() {
    var node = document.getElementById('eapWordExactSummaryStatus');
    var value = text(node && node.textContent);
    return /ผลทบทวนคำที่พลาด.+บันทึกใน Google Sheet แล้ว/.test(value);
  }

  function patch() {
    var screen = document.getElementById('summaryScreen');
    var button = document.getElementById('nextMissionBtn');
    var pending;
    if (!screen || !button) return;
    pending = screen.classList.contains('active') && reviewActive() && !receiptConfirmed();

    if (pending) {
      button.dataset.eapHiddenWhileReviewPending = 'true';
      button.style.setProperty('visibility', 'hidden');
      button.setAttribute('aria-hidden', 'true');
      button.setAttribute('tabindex', '-1');
      return;
    }

    if (button.dataset.eapHiddenWhileReviewPending === 'true') {
      delete button.dataset.eapHiddenWhileReviewPending;
      button.style.removeProperty('visibility');
      button.removeAttribute('aria-hidden');
      button.removeAttribute('tabindex');
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      patch();
    });
  }

  function connect() {
    if (observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','disabled']
    });
  }

  window.addEventListener('eap-word-review-context-changed', schedule);
  window.addEventListener('eap-word-sheet-receipt-confirmed', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { connect(); schedule(); }, { once:true });
  } else {
    connect();
    schedule();
  }

  console.info('[EAP Word Quest] V305 review pending navigation guard ready', { version:VERSION });
})();