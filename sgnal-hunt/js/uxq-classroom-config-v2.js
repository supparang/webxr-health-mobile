/* UX Quest • Classroom Configuration v5.3 • Sunday classroom launch mode
   Public configuration only: the receiver is write-only; no teacher read endpoint lives here.
*/
(() => {
  'use strict';

  const query = new URLSearchParams(location.search || '');
  const rawClassroomMode = String(query.get('classroom') || query.get('uxqClassroom') || '').trim().toLowerCase();
  const classroomMode = ['1', 'true', 'class', 'classroom', 'required'].includes(rawClassroomMode);
  const classroomSection = String(query.get('section') || query.get('uxqSection') || '').trim().slice(0, 80);

  const defaults = {
    receiverUrl: 'https://script.google.com/macros/s/AKfycbzw1_j4b98wxVWuUlEwFKl_jlZkprDjESt5cHIEdgT4lrT2xbt8bj0vWTu6VpTziBlepQ/exec',
    courseId: 'UXQ-ACT1-2026',
    courseLabel: 'UX Quest • Act I',
    defaultSection: classroomSection || '',
    classroomMode: classroomMode ? 'required' : 'practice',
    classroomSection,
    allowGuestPractice: !classroomMode,
    maxQueuedAttempts: 12,
    version: '20260701-classroom-v5.3-sunday-launch'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};
  const merged = Object.assign({}, defaults, existing);

  // A shared classroom link deliberately wins over any older local/demo setting.
  // It makes student identity mandatory and seeds the correct section before a mission begins.
  if (classroomMode) {
    merged.classroomMode = 'required';
    merged.allowGuestPractice = false;
    if (classroomSection) {
      merged.defaultSection = classroomSection;
      merged.classroomSection = classroomSection;
    }
  }

  window.UXQ_CLASSROOM_CONFIG = Object.freeze(merged);

  function carryClassroomParams(){
    if (!classroomMode) return;
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(rawHref)) return;
      let target;
      try { target = new URL(rawHref, location.href); }
      catch (error) { return; }
      if (target.origin !== location.origin || !/\/sgnal-hunt\//.test(target.pathname)) return;
      target.searchParams.set('classroom', '1');
      if (classroomSection) target.searchParams.set('section', classroomSection);
      if (anchor.href !== target.href) anchor.href = target.href;
    });
  }

  function watchClassroomLinks(){
    carryClassroomParams();
    const root = document.documentElement;
    if (!root || root.dataset.uxqClassroomLinkWatch === '1') return;
    root.dataset.uxqClassroomLinkWatch = '1';
    const observer = new MutationObserver(carryClassroomParams);
    observer.observe(root, { childList: true, subtree: true });
  }

  // These helpers are intentionally public so a teacher can share a strict classroom link,
  // while normal self-paced practice remains available without a student-data requirement.
  window.UXQClassroomLaunch = Object.freeze({
    isRequired: () => classroomMode,
    section: () => classroomSection,
    carryLinks: carryClassroomParams
  });

  /* Presentation and evidence enhancements. They never intercept UXQProgress,
     mission-engine scoring, gating, or mission-completed delivery. */
  function loadScript(src, marker){
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    // Dynamic scripts with async=false preserve the transport → UI dependency.
    script.async = false;
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
    document.addEventListener('DOMContentLoaded', () => {
      watchClassroomLinks();
      loadResultSupport();
    }, { once: true });
  } else {
    watchClassroomLinks();
    loadResultSupport();
  }
})();
