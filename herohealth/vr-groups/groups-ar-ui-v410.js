(() => {
  'use strict';

  const PATCH = 'groups-ar-mobile-compact-v4.1.0';
  const $ = (id) => document.getElementById(id);
  const menuButton = $('menuBtn');
  const menu = $('quickMenu');
  const scrim = $('menuScrim');
  const feedback = $('feedback');

  function setMenu(open) {
    if (!menu || !scrim || !menuButton) return;
    menu.hidden = !open;
    scrim.hidden = !open;
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('quickMenuOpen', open);
  }

  menuButton?.addEventListener('click', () => {
    setMenu(menu?.hidden !== false);
  });

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
    toastTimer = window.setTimeout(() => {
      feedback.classList.remove('toastShow');
    }, 1750);
  }

  if (feedback) {
    new MutationObserver(showFeedbackToast).observe(feedback, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  const compactQuery = window.matchMedia('(max-width: 720px)');
  function syncCompactMode() {
    document.documentElement.dataset.groupsLayout = compactQuery.matches ? 'compact' : 'wide';
    if (!compactQuery.matches) setMenu(false);
  }

  compactQuery.addEventListener?.('change', syncCompactMode);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(syncCompactMode, 120);
  });
  syncCompactMode();

  window.HHA_GROUPS_AR_UI = {
    patch: PATCH,
    setMenu,
    showFeedbackToast
  };

  console.info('[Groups AR UI]', PATCH, document.documentElement.dataset.groupsLayout);
})();
