/* UX Quest • Classroom Configuration v3 • Receiver + result receipt UI
   This is public configuration. It contains the write-only Apps Script endpoint,
   never a teacher dashboard or read-data endpoint.
*/
(() => {
  'use strict';

  const defaults = {
    receiverUrl: 'https://script.google.com/macros/s/AKfycbzw1_j4b98wxVWuUlEwFKl_jlZkprDjESt5cHIEdgT4lrT2xbt8bj0vWTu6VpTziBlepQ/exec',

    // Use a stable code for this cohort. It is stored beside every attempt.
    courseId: 'UXQ-ACT1-2026',
    courseLabel: 'UX Quest • Act I',

    // Leave blank when more than one section uses this game. Learners then select their own section.
    defaultSection: '',

    // Learners may practise without a classroom identity. Guest attempts remain in the browser
    // and are never sent to the receiver.
    allowGuestPractice: true,

    // A deliberately small queue prevents a storage issue from interrupting play.
    maxQueuedAttempts: 12,
    version: '20260628-classroom-receipt-v3'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};

  window.UXQ_CLASSROOM_CONFIG = Object.freeze(Object.assign({}, defaults, existing));

  // The UI is loaded once for every Act I mission and observes only its result screen.
  function loadResultReceiptUi(){
    if (document.querySelector('script[data-uxq-result-receipt]')) return;
    const script = document.createElement('script');
    script.src = './js/uxq-result-receipt-v1.js?v=20260628-receipt-v1';
    script.async = true;
    script.dataset.uxqResultReceipt = '1';
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadResultReceiptUi, { once: true });
  else loadResultReceiptUi();
})();
