(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mode = String(params.get('authority') || '').toLowerCase();
  if (mode !== 'firebase' && mode !== 'dual') return;

  const STATE_KEY = 'herohealth_learning_platform_rc2';
  const ACTIVE_KEY = 'herohealth_active_student_id';
  const QUERY_KEYS = [
    'studentId','sid','pid','firebaseUid','firebaseReady','firebaseLogin',
    'firebaseEntry','firebaseReceipt','firebaseAssessmentReceipt',
    'firebaseProgressApplied','authorityRefresh','gameSync','pendingGameSync'
  ];
  const VOLATILE_KEYS = [
    'HHA_HANDWASH_LAST_RESULT','HHA_TOOTHBRUSH_LAST_RESULT',
    'toothbrush_pending_result','HHA_GROUPS_AR_LAST_RESULT',
    'groups_ar_last_result','HHA_GOODJUNK_AR_LAST_RESULT',
    'GOODJUNK_AR_LAST_RESULT','goodjunk_pending_result',
    'HHA_JUMPDUCK_LAST_RESULT','HHA_BALANCE_HOLD_LAST_RESULT',
    'HHA_TOOTHBRUSH_CLASSROOM_CHALLENGE_LAST'
  ];

  let busy = false;
  let originalLogout = null;

  function rememberOriginalLogout() {
    const fn = window.HH && window.HH.logout;
    if (typeof fn === 'function' && !fn.__hhFirebaseLogoutR57 && !fn.__hhFirebaseLogoutR58) {
      originalLogout = fn.bind(window.HH);
    }
  }

  function clearStudentContext() {
    try { localStorage.removeItem(STATE_KEY); } catch (_) {}
    try { localStorage.removeItem(ACTIVE_KEY); } catch (_) {}
    ['HH_FIREBASE_LAST_STUDENT_ID','HH_FIREBASE_BOUND_STUDENT_ID'].forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
    VOLATILE_KEYS.forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  function cleanLogoutUrl() {
    const url = new URL(location.href);
    QUERY_KEYS.forEach(key => url.searchParams.delete(key));
    url.searchParams.set('authority', 'firebase');
    url.searchParams.set('logout', '1');
    url.searchParams.set('logoutAt', String(Date.now()));
    history.replaceState(null, '', url.href);
    return url;
  }

  function fallbackLogin(url) {
    const app = document.getElementById('app');
    if (app && app.children.length > 0 && app.textContent.trim()) return;
    location.replace(url.href);
  }

  function safeLogout() {
    if (busy) return false;
    busy = true;
    clearStudentContext();
    const cleanUrl = cleanLogoutUrl();

    try {
      if (originalLogout) originalLogout();
      else if (window.HH && typeof window.HH.go === 'function') window.HH.go('student');
    } catch (error) {
      console.warn('[HeroHealth Firebase R58] original logout failed', error);
    }

    document.querySelectorAll('#hh-sheet-login-status').forEach(node => node.remove());
    document.documentElement.style.pointerEvents = 'auto';
    if (document.body) {
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = '';
    }

    setTimeout(() => fallbackLogin(cleanUrl), 350);
    return true;
  }
  safeLogout.__hhFirebaseLogoutR58 = true;

  function isLogoutButton(node) {
    const button = node && node.closest ? node.closest('button') : null;
    if (!button) return null;
    const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    const onclick = String(button.getAttribute('onclick') || '');
    return text.includes('ออกจากผู้เล่น') || onclick.includes('HH.logout') ? button : null;
  }

  function intercept(event) {
    const button = isLogoutButton(event.target);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.disabled = true;
    button.textContent = 'กำลังออกจากผู้เล่น…';
    safeLogout();
  }

  rememberOriginalLogout();
  document.addEventListener('pointerup', intercept, true);
  document.addEventListener('click', intercept, true);

  [50, 150, 400].forEach(delay => setTimeout(rememberOriginalLogout, delay));
  setTimeout(() => {
    rememberOriginalLogout();
    if (window.HH) window.HH.logout = safeLogout;
  }, 500);

  console.info('[HeroHealth Firebase R58] safe logout rescue installed');
})();
