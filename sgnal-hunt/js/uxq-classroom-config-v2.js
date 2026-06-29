/* UX Quest • Classroom Configuration v5.1 • Stable mission start + replay coach
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
    version: '20260629-classroom-v5.1-replay-coach'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};

  window.UXQ_CLASSROOM_CONFIG = Object.freeze(Object.assign({}, defaults, existing));

  /* Presentation-only enhancements. They never intercept UXQProgress,
     mission-engine start handlers, learner identity, scoring, or sync. */
  function loadPresentationScript(src, marker){
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  function loadResultPresentation(){
    loadPresentationScript('./js/uxq-result-receipt-v1.js?v=20260629-receipt-v1-1', 'data-uxq-result-receipt');
    loadPresentationScript('./js/uxq-anti-guess-coach-v1.js?v=20260629-replay-coach-v1', 'data-uxq-replay-coach');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadResultPresentation, { once: true });
  } else {
    loadResultPresentation();
  }
})();
