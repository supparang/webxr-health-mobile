/* UX Quest • Classroom Configuration v5.9 • Thai learner interface */
(() => {
  'use strict';

  const query = new URLSearchParams(location.search || '');
  const rawClassroomMode = String(query.get('classroom') || query.get('uxqClassroom') || '').trim().toLowerCase();
  const classroomMode = ['1', 'true', 'class', 'classroom', 'required'].includes(rawClassroomMode);
  const freshStart = ['1', 'true', 'fresh', 'new', 'reset'].includes(String(query.get('fresh') || query.get('newLearner') || '').trim().toLowerCase());

  if (/w1-ux-crisis-casefile\.html/i.test(location.pathname) && document.readyState === 'loading') {
    document.write('<script src="./js/uxq-w1-week1-alignment-v1.js?v=20260703-w1-alignment-v1"><\\/script>');
  }
  if (/w4-user-insight-lab\.html/i.test(location.pathname) && document.readyState === 'loading') {
    document.write('<script src="./js/uxq-w4-engine-hook-v1.js?v=20260702-w4-bank-v1"><\\/script><script src="./js/uxq-w4-extra-bank-v1.js?v=20260702-w4-bank-v1"><\\/script>');
  }

  function normalizeSection(value){
    return String(value || '').trim().replace(/^(?:section|sec)[\s_-]*/i, '').trim().slice(0, 80);
  }
  const classroomSection = normalizeSection(query.get('section') || query.get('uxqSection'));

  function removeStored(key){
    try { window.localStorage.removeItem(key); } catch (error) {}
    try { window.sessionStorage.removeItem(key); } catch (error) {}
  }
  function clearFreshClassroomState(){
    ['uxq.act1.progress.v2','uxq.act1.progress.v1','uxq.classroom.profile.v1','uxq.classroom.queue.v1','uxq.classroom.last-receipt.v1','uxq.reason-retry.queue.v1','uxq.w1.first-impression.v1'].forEach(removeStored);
    ['w1','w2','w3','b1','w4'].forEach((id) => {
      removeStored(`uxq.recent.${id}.v1`); removeStored(`uxq.recent.${id}.v2`);
      removeStored(`uxq.run.${id}.v1`); removeStored(`uxq.run.${id}.v2`);
    });
  }
  if (classroomMode && freshStart) {
    clearFreshClassroomState();
    try {
      const clean = new URL(location.href);
      clean.searchParams.delete('fresh'); clean.searchParams.delete('newLearner');
      window.history.replaceState({}, '', `${clean.pathname}${clean.search}${clean.hash}`);
    } catch (error) {}
  }

  const defaults = {
    receiverUrl: 'https://script.google.com/macros/s/AKfycbzw1_j4b98wxVWuUlEwFKl_jlZkprDjESt5cHIEdgT4lrT2xbt8bj0vWTu6VpTziBlepQ/exec',
    courseId: 'UXQ-ACT1-2026', courseLabel: 'UX Quest • Act I',
    defaultSection: classroomSection || '', classroomMode: classroomMode ? 'required' : 'practice',
    classroomSection, allowGuestPractice: !classroomMode, maxQueuedAttempts: 12,
    version: '20260703-classroom-v5.9-w1-alignment'
  };
  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object') ? window.UXQ_CLASSROOM_CONFIG : {};
  const merged = Object.assign({}, defaults, existing);
  if (classroomMode) {
    merged.classroomMode = 'required'; merged.allowGuestPractice = false;
    if (classroomSection) { merged.defaultSection = classroomSection; merged.classroomSection = classroomSection; }
  }
  window.UXQ_CLASSROOM_CONFIG = Object.freeze(merged);

  function withClassroomParams(rawHref){
    let target;
    try { target = new URL(rawHref, location.href); } catch (error) { return null; }
    if (target.origin !== location.origin || !/\/sgnal-hunt\//.test(target.pathname)) return null;
    target.searchParams.set('classroom', '1');
    if (classroomSection) target.searchParams.set('section', classroomSection);
    target.searchParams.delete('fresh'); target.searchParams.delete('newLearner');
    return target;
  }
  function carryClassroomParams(){
    if (!classroomMode) return;
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(rawHref)) return;
      const target = withClassroomParams(rawHref);
      if (target && anchor.href !== target.href) anchor.href = target.href;
    });
  }
  function enforceClassroomSection(){
    if (!classroomMode || !classroomSection) return;
    const input = document.getElementById('uxqProfileSection');
    if (!input) return;
    if (input.value !== classroomSection) input.value = classroomSection;
    input.readOnly = true; input.setAttribute('aria-readonly', 'true');
    const label = input.closest('label');
    if (label && !label.querySelector('[data-uxq-classroom-section-note]')) {
      const note = document.createElement('small'); note.dataset.uxqClassroomSectionNote = '1';
      note.textContent = `กลุ่มถูกกำหนดเป็น ${classroomSection} สำหรับคาบนี้`;
      note.style.color = '#9fddff'; note.style.fontWeight = '700'; label.appendChild(note);
    }
  }
  function guardClassroomSectionSubmit(event){
    if (!classroomMode || !classroomSection) return;
    const form = event.target;
    if (!form || form.id !== 'uxqProfileForm') return;
    const input = form.querySelector('#uxqProfileSection'); if (input) input.value = classroomSection;
  }
  function classroomMissionHref(missionId){
    const files = {w1:'./w1-ux-crisis-casefile.html',w2:'./w2-design-thinking-sprint.html',w3:'./w3-cognitive-load-escape.html',b1:'./b1-cognitive-storm.html',w4:'./w4-user-insight-lab.html'};
    return withClassroomParams(files[missionId] || './index.html');
  }
  function guardMissionNavigation(event){
    if (!classroomMode || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const pathStep = target.closest('.path-step');
    if (pathStep && pathStep.classList.contains('path-step--launchable')) {
      const missionId = ({pathW1:'w1',pathW2:'w2',pathW3:'w3',pathB1:'b1',pathW4:'w4'})[pathStep.id];
      const destination = classroomMissionHref(missionId);
      if (destination) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(destination.href); }
      return;
    }
    const button = target.closest('#nodeW3 .compact-stage__footer button, #nodeB1 .boss-preview__footer button, #nodeW4 .boss-preview__footer button');
    if (button && !button.disabled) {
      const missionId = button.closest('#nodeW3') ? 'w3' : (button.closest('#nodeW4') ? 'w4' : 'b1');
      const destination = classroomMissionHref(missionId);
      if (destination) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(destination.href); }
      return;
    }
    const anchor = target.closest('a[href]'); if (!anchor) return;
    const destination = withClassroomParams(anchor.getAttribute('href'));
    if (!destination) return;
    event.preventDefault(); event.stopImmediatePropagation(); location.assign(destination.href);
  }
  function watchClassroomLinks(){
    carryClassroomParams(); enforceClassroomSection();
    const root = document.documentElement;
    if (!root || root.dataset.uxqClassroomLinkWatch === '1') return;
    root.dataset.uxqClassroomLinkWatch = '1';
    document.addEventListener('submit', guardClassroomSectionSubmit, true);
    document.addEventListener('click', guardMissionNavigation, true);
    new MutationObserver(() => { carryClassroomParams(); enforceClassroomSection(); }).observe(root, {childList:true,subtree:true});
  }
  window.UXQClassroomLaunch = Object.freeze({isRequired:()=>classroomMode,section:()=>classroomSection,freshStart:()=>freshStart,carryLinks:carryClassroomParams});

  function loadScript(src, marker){
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script'); script.src = src; script.async = false; script.setAttribute(marker, '1'); document.head.appendChild(script);
  }
  function loadResultSupport(){
    loadScript('./js/uxq-engine-thai-v1.js?v=20260702-engine-thai-v1','data-uxq-engine-thai');
    loadScript('./js/uxq-result-receipt-v1.js?v=20260629-receipt-v1-1','data-uxq-result-receipt');
    loadScript('./js/uxq-anti-guess-coach-v1.js?v=20260629-replay-coach-v1','data-uxq-anti-guess-coach');
    loadScript('./js/uxq-reason-retry-transport-v1.js?v=20260629-reason-transport-v1','data-uxq-reason-transport');
    loadScript('./js/uxq-explain-why-retry-v1.js?v=20260629-explain-retry-v1','data-uxq-explain-retry');
    if (/w4-user-insight-lab\.html/i.test(location.pathname)) loadScript('./js/uxq-w4-thai-first-v1.js?v=20260702-thai-only-v2','data-uxq-w4-thai-first');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { watchClassroomLinks(); loadResultSupport(); }, {once:true});
  else { watchClassroomLinks(); loadResultSupport(); }
})();
