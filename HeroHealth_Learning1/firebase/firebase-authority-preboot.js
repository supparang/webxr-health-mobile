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

  const removeSheetOverlay = () => {
    document.getElementById('hh-sheet-login-status')?.remove();
    document.documentElement.dataset.hhLoginBusy = '0';
  };

  addEventListener('DOMContentLoaded', () => {
    removeSheetOverlay();
    const observer = new MutationObserver(removeSheetOverlay);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }, { once: true });
})();
