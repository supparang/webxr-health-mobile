/* UX Quest • Classroom Configuration v5 • Stable mission-start hotfix
   Public configuration only: the receiver is write-only; no teacher read endpoint lives here.
*/
(() => {
  'use strict';

  const defaults = {
    receiverUrl: 'https://script.google.com/macros/s/AKfycbzw1_j4b98wxVWuUlEwFKl_jlZkprDjESt5cHIEdgT4lrT2xbt8bj0vWTu6VpTziBlepQ/exec',
    courseId: 'UXQ-ACT1-2026',
    courseLabel: 'UX Quest • Act I',
    defaultSection: '',
    allowGuestPractice: true,
    maxQueuedAttempts: 12,
    version: '20260628-classroom-v5-start-hotfix'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};

  window.UXQ_CLASSROOM_CONFIG = Object.freeze(Object.assign({}, defaults, existing));

  /* Result receipt is presentation-only. It must never intercept UXQProgress,
     mission-engine start handlers, or learner-profile flow. */
  function loadResultReceiptUi(){
    if (document.querySelector('script[data-uxq-result-receipt]')) return;
    const script = document.createElement('script');
    script.src = './js/uxq-result-receipt-v1.js?v=20260628-receipt-v1';
    script.async = true;
    script.dataset.uxqResultReceipt = '1';
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadResultReceiptUi, { once: true });
  } else {
    loadResultReceiptUi();
  }
})();
