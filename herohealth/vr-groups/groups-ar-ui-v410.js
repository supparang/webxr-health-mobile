(() => {
  'use strict';

  const PATCH = 'groups-ar-mobile-student-ui-v5.0.0';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const passportMode = window.parent !== window ||
    params.get('classroom') === '1' ||
    params.get('passport') === '1' ||
    params.get('embedded') === '1' ||
    params.get('from') === 'passport';

  const menuButton = $('menuBtn');
  const menu = $('quickMenu');
  const scrim = $('menuScrim');
  const feedback = $('feedback');

  function setMenu(open) {
    if (!menu || !scrim || !menuButton || passportMode) return;
    menu.hidden = !open;
    scrim.hidden = !open;
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('quickMenuOpen', open);
  }

  menuButton?.addEventListener('click', () => setMenu(menu?.hidden !== false));
  scrim?.addEventListener('click', () => setMenu(false));
  $('menuCloseBtn')?.addEventListener('click', () => setMenu(false));
  $('menuQaBtn')?.addEventListener('click', () => {
    setMenu(false);
    $('qaBtn')?.click();
  });
  $('menuZoneBtn')?.addEventListener('click', () => {
    setMenu(false);
    $('zoneBtn')?.click();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  let toastTimer = 0;
  function showFeedbackToast() {
    if (!feedback || !feedback.textContent.trim()) return;
    feedback.classList.remove('toastShow');
    void feedback.offsetWidth;
    feedback.classList.add('toastShow');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => feedback.classList.remove('toastShow'), 1750);
  }

  if (feedback) {
    new MutationObserver(showFeedbackToast).observe(feedback, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function cleanStudentText() {
    const replacements = new Map([
      ['เปิด Camera AR ไม่สำเร็จ', 'เปิดกล้องไม่สำเร็จ'],
      ['AR ยังไม่พร้อม', 'กล้องยังไม่พร้อม'],
      ['Camera Check', 'ตรวจกล้องและมือ'],
      ['Hand AR', 'พร้อมใช้มือ'],
      ['Touch Fallback', ''],
      ['Touch AR', '']
    ]);
    ['arOnlyTitle', 'cameraText', 'phaseTitle', 'phaseSub', 'feedback'].forEach((id) => {
      const element = $(id);
      if (!element) return;
      const next = replacements.get(element.textContent.trim());
      if (next !== undefined) element.textContent = next;
    });
  }

  function applyPassportUi() {
    if (!passportMode) return;
    const controls = document.querySelector('.footer .controls');
    if (controls) controls.style.display = 'none';
    ['qaBtn', 'zoneBtn', 'menuBtn', 'menuZoneBtn'].forEach((id) => {
      const element = $(id);
      if (element) element.style.display = 'none';
    });
    setMenu(false);

    try {
      const parentDoc = window.parent.document;
      const parentStatus = parentDoc.getElementById('status');
      if (parentStatus) parentStatus.style.display = 'none';
      const parentTitle = parentDoc.getElementById('title');
      if (parentTitle) parentTitle.textContent = 'ภารกิจอาหาร 5 หมู่';
    } catch (_) {}
  }

  const compactQuery = window.matchMedia('(max-width: 720px)');
  function syncCompactMode() {
    document.documentElement.dataset.groupsLayout = compactQuery.matches ? 'compact' : 'wide';
    if (!compactQuery.matches) setMenu(false);
    applyPassportUi();
    cleanStudentText();
  }

  compactQuery.addEventListener?.('change', syncCompactMode);
  window.addEventListener('orientationchange', () => window.setTimeout(syncCompactMode, 120));

  const textObserver = new MutationObserver(() => {
    cleanStudentText();
    applyPassportUi();
  });
  textObserver.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true
  });

  syncCompactMode();

  window.HHA_GROUPS_AR_UI = {
    patch: PATCH,
    setMenu,
    showFeedbackToast,
    applyPassportUi,
    cleanStudentText
  };

  console.info('[Groups AR UI]', PATCH, document.documentElement.dataset.groupsLayout);
})();
