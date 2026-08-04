(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mode = String(params.get('authority') || '').toLowerCase();
  if (mode !== 'firebase' && mode !== 'dual') return;

  const RELEASE = '20260804-FIREBASE-DIRECT-LOGOUT-R65';
  const LOCAL_KEYS = [
    'herohealth_learning_platform_rc2',
    'herohealth_active_student_id',
    'HH_FIREBASE_LAST_STUDENT_ID',
    'HH_FIREBASE_BOUND_STUDENT_ID',
    'HH_ACTIVE_STUDENT_ID',
    'HH_CURRENT_STUDENT_ID',
    'HH_PROFILE_CACHE',
    'HHA_HANDWASH_LAST_RESULT',
    'HHA_TOOTHBRUSH_LAST_RESULT',
    'toothbrush_pending_result',
    'HHA_GROUPS_AR_LAST_RESULT',
    'groups_ar_last_result',
    'HHA_GOODJUNK_AR_LAST_RESULT',
    'GOODJUNK_AR_LAST_RESULT',
    'goodjunk_pending_result',
    'HHA_JUMPDUCK_LAST_RESULT',
    'HHA_BALANCE_HOLD_LAST_RESULT',
    'HHA_TOOTHBRUSH_CLASSROOM_CHALLENGE_LAST'
  ];

  let leaving = false;

  function clearContext() {
    LOCAL_KEYS.forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
    try { localStorage.setItem('HH_AUTHORITY_MODE', 'firebase'); } catch (_) {}
    try { sessionStorage.setItem('HH_AUTHORITY_MODE', 'firebase'); } catch (_) {}
  }

  function cleanLoginUrl() {
    const url = new URL('./index.html', location.href);
    url.searchParams.set('authority', 'firebase');
    url.searchParams.set('logout', '1');
    url.searchParams.set('logoutAt', String(Date.now()));
    url.searchParams.set('v', '20260804-logout-r65');
    return url.href;
  }

  function directLogout(event) {
    if (leaving) return false;
    leaving = true;
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }
    clearContext();
    document.documentElement.dataset.hhLoggingOut = '1';
    const target = cleanLoginUrl();
    try { location.replace(target); }
    catch (_) { location.href = target; }
    return false;
  }

  function isLogoutElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    const onclick = String(el.getAttribute?.('onclick') || '');
    return text.includes('ออกจากผู้เล่น') || onclick.includes('HH.logout');
  }

  function bindLogoutElement(el) {
    if (!isLogoutElement(el) || el.dataset.hhFirebaseLogoutR65 === '1') return;
    el.dataset.hhFirebaseLogoutR65 = '1';
    try { el.disabled = false; } catch (_) {}
    el.removeAttribute?.('disabled');
    el.removeAttribute?.('aria-disabled');
    el.style.pointerEvents = 'auto';
    el.style.touchAction = 'manipulation';
    el.style.cursor = 'pointer';
    el.onclick = directLogout;
    ['touchstart', 'pointerdown', 'pointerup', 'click'].forEach(type => {
      el.addEventListener(type, directLogout, { capture: true, passive: false });
    });
  }

  function scan() {
    document.querySelectorAll('button,a,[role="button"],.btn,.btn-soft').forEach(bindLogoutElement);
    if (window.HH) {
      window.HH.logout = directLogout;
      window.HH.logout.__hhFirebaseDirectR65 = true;
    }
  }

  const capture = event => {
    const path = event.composedPath?.() || [];
    const target = path.find(isLogoutElement) || event.target?.closest?.('button,a,[role="button"],.btn,.btn-soft');
    if (!isLogoutElement(target)) return;
    directLogout(event);
  };

  ['touchstart', 'pointerdown', 'pointerup', 'click'].forEach(type => {
    document.addEventListener(type, capture, { capture: true, passive: false });
  });

  const observer = new MutationObserver(scan);
  const boot = () => {
    scan();
    observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    [100, 300, 700, 1500, 3000].forEach(delay => setTimeout(scan, delay));
    console.info('[HeroHealth Firebase] direct mobile logout installed', RELEASE);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
