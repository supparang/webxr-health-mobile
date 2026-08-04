(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mode = String(params.get('authority') || '').toLowerCase();
  if (mode !== 'firebase' && mode !== 'dual') return;

  const RELEASE = '20260804-FIREBASE-DIRECT-SESSION-R66';
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
  let entering = false;

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
    url.searchParams.set('v', '20260804-session-r66');
    return url.href;
  }

  function directLogout(event) {
    if (leaving) return false;
    leaving = true;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    clearContext();
    document.documentElement.dataset.hhLoggingOut = '1';
    const target = cleanLoginUrl();
    try { location.replace(target); }
    catch (_) { location.href = target; }
    return false;
  }

  function normalizeSid(value) {
    return String(value || '').trim().replace(/\s+/g, '');
  }

  function findLoginForm(el) {
    const form = el?.closest?.('form') || document.querySelector('#hh-firebase-login-form') || document.querySelector('#app form');
    if (!form) return null;
    const input = form.querySelector('[name="studentId"], input[inputmode="numeric"], input');
    return input ? { form, input } : null;
  }

  async function directLogin(event, button) {
    if (entering || leaving) return false;
    const info = findLoginForm(button || event?.target);
    if (!info) return false;

    const sid = normalizeSid(info.input.value);
    if (!sid) {
      info.input.focus();
      return false;
    }

    entering = true;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    const originalText = String(button?.textContent || 'ตรวจสอบและเข้าสู่ภารกิจ');
    if (button) {
      button.disabled = true;
      button.textContent = 'กำลังตรวจสอบ Firebase…';
    }

    try {
      const module = await import('./herohealth-firebase-client.js?cv=20260804-session-r66');
      const client = module.HHFirebaseClient;
      if (!client) throw new Error('ไม่พบ Firebase Client');

      const roster = await client.readRoster(sid);
      if (!roster?.ok) {
        if (roster?.reason === 'student-not-found') throw new Error('ไม่พบรหัสนักเรียนนี้ใน Firebase');
        if (roster?.reason === 'student-inactive') throw new Error('รหัสนักเรียนนี้ถูกปิดใช้งาน');
        throw new Error('ตรวจสอบรหัสกับ Firebase ไม่สำเร็จ');
      }

      const binding = await client.bindStudent(sid);
      if (binding?.ok === false) throw new Error('ผูกอุปกรณ์กับรหัสนักเรียนไม่สำเร็จ');

      try {
        localStorage.setItem('herohealth_active_student_id', sid);
        localStorage.setItem('HH_FIREBASE_LAST_STUDENT_ID', sid);
        localStorage.setItem('HH_AUTHORITY_MODE', 'firebase');
        sessionStorage.setItem('HH_AUTHORITY_MODE', 'firebase');
      } catch (_) {}

      const url = new URL('./index.html', location.href);
      url.searchParams.set('authority', 'firebase');
      url.searchParams.set('studentId', sid);
      url.searchParams.set('sid', sid);
      url.searchParams.set('firebaseReady', '1');
      url.searchParams.set('firebaseLogin', '1');
      url.searchParams.set('firebaseLoginAt', String(Date.now()));
      url.searchParams.set('v', '20260804-session-r66');
      ['logout', 'logoutAt', 'logoutNonce'].forEach(key => url.searchParams.delete(key));
      location.replace(url.href);
    } catch (error) {
      console.error('[HeroHealth Firebase R66] direct login failed', error);
      alert(error?.message || 'เข้าสู่ภารกิจไม่สำเร็จ');
      entering = false;
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
    return false;
  }

  function textOf(el) {
    return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isLogoutElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const text = textOf(el);
    const onclick = String(el.getAttribute?.('onclick') || '');
    return text.includes('ออกจากผู้เล่น') || onclick.includes('HH.logout');
  }

  function isLoginElement(el) {
    if (!el || el.nodeType !== 1 || isLogoutElement(el)) return false;
    const text = textOf(el);
    return text.includes('ตรวจสอบและเข้าสู่ภารกิจ') ||
      (text.includes('ตรวจสอบ') && text.includes('ภารกิจ'));
  }

  function bindLogoutElement(el) {
    if (!isLogoutElement(el) || el.dataset.hhFirebaseSessionR66 === 'logout') return;
    el.dataset.hhFirebaseSessionR66 = 'logout';
    try { el.disabled = false; } catch (_) {}
    el.removeAttribute?.('disabled');
    el.removeAttribute?.('aria-disabled');
    el.style.pointerEvents = 'auto';
    el.style.touchAction = 'manipulation';
    el.style.cursor = 'pointer';
    el.onclick = directLogout;
    ['touchend', 'pointerup', 'click'].forEach(type => {
      el.addEventListener(type, directLogout, { capture: true, passive: false });
    });
  }

  function bindLoginElement(el) {
    if (!isLoginElement(el) || el.dataset.hhFirebaseSessionR66 === 'login') return;
    el.dataset.hhFirebaseSessionR66 = 'login';
    try { el.disabled = false; } catch (_) {}
    el.removeAttribute?.('disabled');
    el.removeAttribute?.('aria-disabled');
    el.style.pointerEvents = 'auto';
    el.style.touchAction = 'manipulation';
    el.style.cursor = 'pointer';
    el.onclick = event => directLogin(event, el);
    ['touchend', 'pointerup', 'click'].forEach(type => {
      el.addEventListener(type, event => directLogin(event, el), { capture: true, passive: false });
    });
  }

  function scan() {
    document.querySelectorAll('button,a,[role="button"],.btn,.btn-soft,.btn-primary').forEach(el => {
      bindLogoutElement(el);
      bindLoginElement(el);
    });
    if (window.HH) {
      window.HH.logout = directLogout;
      window.HH.logout.__hhFirebaseDirectR66 = true;
    }
  }

  const capture = event => {
    const path = event.composedPath?.() || [];
    const candidate = path.find(el => isLogoutElement(el) || isLoginElement(el)) ||
      event.target?.closest?.('button,a,[role="button"],.btn,.btn-soft,.btn-primary');
    if (isLogoutElement(candidate)) return directLogout(event);
    if (isLoginElement(candidate)) return directLogin(event, candidate);
  };

  ['touchend', 'pointerup', 'click'].forEach(type => {
    document.addEventListener(type, capture, { capture: true, passive: false });
  });

  document.addEventListener('submit', event => {
    const info = findLoginForm(event.target);
    if (!info) return;
    const button = info.form.querySelector('button[type="submit"],.btn-primary,button');
    if (!button || !isLoginElement(button)) return;
    directLogin(event, button);
  }, true);

  const observer = new MutationObserver(scan);
  const boot = () => {
    scan();
    observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    [100, 300, 700, 1500, 3000].forEach(delay => setTimeout(scan, delay));
    console.info('[HeroHealth Firebase] direct session bridge installed', RELEASE);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
