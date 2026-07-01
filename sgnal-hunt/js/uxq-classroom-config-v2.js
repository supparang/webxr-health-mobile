/* UX Quest • Classroom Configuration v5.4 • Sunday classroom lock
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
    version: '20260701-classroom-v5.4-sunday-section-lock'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};
  const merged = Object.assign({}, defaults, existing);

  // A shared classroom link deliberately wins over any older local/demo setting.
  // It makes learner identity mandatory and pins the intended section.
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

  function enforceClassroomSection(){
    if (!classroomMode || !classroomSection) return;
    const input = document.getElementById('uxqProfileSection');
    if (!input) return;
    if (input.value !== classroomSection) input.value = classroomSection;
    input.readOnly = true;
    input.setAttribute('aria-readonly', 'true');
    input.title = `Section is set to ${classroomSection} for this class.`;

    const label = input.closest('label');
    if (label && !label.querySelector('[data-uxq-classroom-section-note]')) {
      const note = document.createElement('small');
      note.dataset.uxqClassroomSectionNote = '1';
      note.textContent = `กลุ่มถูกกำหนดเป็น ${classroomSection} สำหรับคาบนี้`;
      note.style.color = '#9fddff';
      note.style.fontWeight = '700';
      label.appendChild(note);
    }
  }

  function guardClassroomSectionSubmit(event){
    if (!classroomMode || !classroomSection) return;
    const form = event.target;
    if (!form || form.id !== 'uxqProfileForm') return;
    const input = form.querySelector('#uxqProfileSection');
    if (input) input.value = classroomSection;
  }

  function watchClassroomLinks(){
    carryClassroomParams();
    enforceClassroomSection();
    const root = document.documentElement;
    if (!root || root.dataset.uxqClassroomLinkWatch === '1') return;
    root.dataset.uxqClassroomLinkWatch = '1';
    document.addEventListener('submit', guardClassroomSectionSubmit, true);
    const observer = new MutationObserver(() => {
      carryClassroomParams();
      enforceClassroomSection();
    });
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
