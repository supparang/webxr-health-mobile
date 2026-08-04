(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mode = String(params.get('authority') || 'sheet').toLowerCase();
  if (mode !== 'firebase') return;

  const studentId = String(
    params.get('studentId') || params.get('pid') || params.get('sid') || ''
  ).trim();
  const sheetResumeVersion = '20260730-MOBILE-AUTHORITY-V8.3-SYNTAX-FIX';

  window.HH_AUTHORITY_MODE = 'firebase';
  window.HH_DISABLE_SHEET_RESUME = true;
  document.documentElement.dataset.hhAuthority = 'firebase';
  document.documentElement.dataset.hhLoginBusy = '0';

  if (studentId) {
    try {
      localStorage.setItem(`hh_authority_version_synced:${studentId}`, sheetResumeVersion);
      sessionStorage.setItem(`hh_authority_bootstrap:${studentId}`, String(Date.now()));
    } catch (_) {}
  }

  // Hide only the legacy Sheet blocking overlay. Never hide body or #app.
  const style = document.createElement('style');
  style.id = 'hh-firebase-preboot-style';
  style.textContent = `
    html[data-hh-authority="firebase"] #hh-sheet-login-status {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);

  // student-resume-v7-mobile.js schedules its automatic Sheet bootstrap with
  // setTimeout(bootstrapAuthority, 0). Suppress that one named callback only;
  // all application timers continue to work normally.
  const nativeSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = function firebaseAuthorityTimeoutGuard(callback, delay, ...args) {
    const callbackName = typeof callback === 'function' ? String(callback.name || '') : '';
    if (window.HH_DISABLE_SHEET_RESUME && callbackName === 'bootstrapAuthority') {
      console.info('[HeroHealth Firebase] skipped Google Sheet bootstrap');
      return 0;
    }
    return nativeSetTimeout(callback, delay, ...args);
  };

  const removeLegacyOverlay = () => {
    const overlay = document.getElementById('hh-sheet-login-status');
    if (overlay) overlay.remove();
    if (document.documentElement.dataset.hhLoginBusy !== '0') {
      document.documentElement.dataset.hhLoginBusy = '0';
    }
  };

  addEventListener('DOMContentLoaded', removeLegacyOverlay, { once: true });
  addEventListener('load', removeLegacyOverlay, { once: true });
})();
