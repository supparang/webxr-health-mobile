/* UX Quest • Classroom Configuration v5.2 • Reason Check review support
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
    version: '20260629-classroom-v5.2-reason-review'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};

  window.UXQ_CLASSROOM_CONFIG = Object.freeze(Object.assign({}, defaults, existing));

  /* Presentation and evidence enhancements. They never intercept UXQProgress,
     mission-engine scoring, gating, or mission-completed delivery. */
  function loadScript(src, marker){
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  function loadResultSupport(){
    loadScript('./js/uxq-result-receipt-v1.js?v=20260629-receipt-v1-1', 'data-uxq-result-receipt');
    loadScript('./js/uxq-anti-guess-coach-v1.js?v=20260629-replay-coach-v1', 'data-uxq-replay-coach');
    loadScript('./js/uxq-reason-retry-transport-v1.js?v=20260629-reason-transport-v1', 'data-uxq-reason-transport');
    loadScript('./js/uxq-explain-why-retry-v1.js?v=20260629-explain-retry-v1', 'data-uxq-explain-retry');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadResultSupport, { once: true });
  } else {
    loadResultSupport();
  }
})();
