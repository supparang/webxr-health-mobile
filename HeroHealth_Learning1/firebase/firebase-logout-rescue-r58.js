(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mode = String(params.get('authority') || '').toLowerCase();
  if (mode !== 'firebase' && mode !== 'dual') return;

  const RELEASE = '20260804-FIREBASE-DIRECT-SESSION-R68-PROFILE-HANDOFF';
  const STATE_KEY = 'herohealth_learning_platform_rc2';
  const ACTIVE_KEY = 'herohealth_active_student_id';
  const LOCAL_KEYS = [
    STATE_KEY, ACTIVE_KEY,
    'HH_FIREBASE_LAST_STUDENT_ID', 'HH_FIREBASE_BOUND_STUDENT_ID',
    'HH_ACTIVE_STUDENT_ID', 'HH_CURRENT_STUDENT_ID', 'HH_PROFILE_CACHE',
    'HHA_HANDWASH_LAST_RESULT', 'HHA_TOOTHBRUSH_LAST_RESULT',
    'toothbrush_pending_result', 'HHA_GROUPS_AR_LAST_RESULT',
    'groups_ar_last_result', 'HHA_GOODJUNK_AR_LAST_RESULT',
    'GOODJUNK_AR_LAST_RESULT', 'goodjunk_pending_result',
    'HHA_JUMPDUCK_LAST_RESULT', 'HHA_BALANCE_HOLD_LAST_RESULT',
    'HHA_TOOTHBRUSH_CLASSROOM_CHALLENGE_LAST'
  ];

  let entering = false;
  let leaving = false;

  function textOf(el) {
    return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeSid(value) {
    return String(value || '').trim().replace(/\s+/g, '');
  }

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function normalizeProfile(roster, sid) {
    const source = roster || {};
    const group = String(source.group || source.rotationGroup || source.conditionGroup || 'A');
    return {
      ...source,
      studentId: sid,
      fullName: String(source.fullName || source.studentName || source.name || source.nickname || `นักเรียน ${sid}`),
      nickname: String(source.nickname || ''),
      section: String(source.section || source.classId || 'QA-P5'),
      classId: String(source.classId || source.section || 'QA-P5'),
      group,
      rotationGroup: String(source.rotationGroup || group),
      active: source.active !== false,
      authority: 'firebase'
    };
  }

  function saveProfileHandoff(profile, sid, uid = '') {
    const current = readState();
    const next = {
      ...current,
      profile,
      pendingProfile: null,
      group: profile.group || current.group || 'A',
      view: 'student',
      firebaseAuthority: {
        ...(current.firebaseAuthority || {}),
        mode: 'firebase',
        studentId: sid,
        uid,
        profileHydratedAt: new Date().toISOString(),
        release: RELEASE
      }
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    localStorage.setItem(ACTIVE_KEY, sid);
    localStorage.setItem('HH_FIREBASE_LAST_STUDENT_ID', sid);
    localStorage.setItem('HH_AUTHORITY_MODE', 'firebase');
    sessionStorage.setItem('HH_AUTHORITY_MODE', 'firebase');
  }

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
    [...url.searchParams.keys()].forEach(key => url.searchParams.delete(key));
    url.searchParams.set('authority', 'firebase');
    url.searchParams.set('logout', '1');
    url.searchParams.set('logoutAt', String(Date.now()));
    url.searchParams.set('v', '20260804-session-r68');
    return url.href;
  }

  function directLogout(event) {
    if (leaving) return false;
    leaving = true;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    clearContext();
    const target = cleanLoginUrl();
    try { location.replace(target); }
    catch (_) { location.href = target; }
    return false;
  }

  function findLoginForm(el) {
    const form = el?.closest?.('form') || document.querySelector('#hh-firebase-login-form') || document.querySelector('#app form');
    if (!form) return null;
    const input = form.querySelector('[name="studentId"],input[inputmode="numeric"],input');
    return input ? { form, input } : null;
  }

  async function directLogin(event, button) {
    if (entering || leaving) return false;
    const info = findLoginForm(button || event?.target);
    if (!info) return false;
    const sid = normalizeSid(info.input.value);
    if (!sid) { info.input.focus(); return false; }

    entering = true;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    const originalText = String(button?.textContent || 'ตรวจสอบและเข้าสู่ภารกิจ');
    if (button) {
      button.disabled = true;
      button.textContent = 'กำลังตรวจสอบและกู้ความคืบหน้า…';
    }

    try {
      const module = await import('./herohealth-firebase-client.js?cv=20260804-permission-fix-r67');
      const client = module.HHFirebaseClient;
      if (!client) throw new Error('ไม่พบ Firebase Client');

      const rosterResult = await client.readRoster(sid);
      if (!rosterResult?.ok) {
        if (rosterResult?.reason === 'student-not-found') throw new Error('ไม่พบรหัสนักเรียนนี้ใน Firebase');
        if (rosterResult?.reason === 'student-inactive') throw new Error('รหัสนักเรียนนี้ถูกปิดใช้งาน');
        throw new Error('ตรวจสอบรหัสกับ Firebase ไม่สำเร็จ');
      }

      const binding = await client.bindStudent(sid);
      if (!binding?.ok) throw new Error('ผูกอุปกรณ์กับรหัสนักเรียนไม่สำเร็จ');

      const profile = normalizeProfile(rosterResult.roster, sid);
      saveProfileHandoff(profile, sid, binding.user?.uid || rosterResult.user?.uid || '');

      const url = new URL('./index.html', location.href);
      [...url.searchParams.keys()].forEach(key => url.searchParams.delete(key));
      url.searchParams.set('authority', 'firebase');
      url.searchParams.set('studentId', sid);
      url.searchParams.set('sid', sid);
      url.searchParams.set('firebaseReady', '1');
      url.searchParams.set('firebaseLogin', '1');
      url.searchParams.set('profileReady', '1');
      url.searchParams.set('firebaseLoginAt', String(Date.now()));
      url.searchParams.set('v', '20260804-session-r68');
      location.replace(url.href);
    } catch (error) {
      console.error('[HeroHealth Firebase R68] login failed', error);
      alert(error?.message || 'เข้าสู่ภารกิจไม่สำเร็จ');
      entering = false;
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
    return false;
  }

  function isLogoutElement(el) {
    if (!el || el.nodeType !== 1) return false;
    return textOf(el).includes('ออกจากผู้เล่น') || String(el.getAttribute?.('onclick') || '').includes('HH.logout');
  }

  function isLoginElement(el) {
    if (!el || el.nodeType !== 1 || isLogoutElement(el)) return false;
    const text = textOf(el);
    return text.includes('ตรวจสอบและเข้าสู่ภารกิจ') || (text.includes('ตรวจสอบ') && text.includes('ภารกิจ'));
  }

  function bindElement(el) {
    if (isLogoutElement(el) && el.dataset.hhFirebaseR68 !== 'logout') {
      el.dataset.hhFirebaseR68 = 'logout';
      el.disabled = false;
      el.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
      el.style.pointerEvents = 'auto';
      el.style.touchAction = 'manipulation';
      ['touchend', 'pointerup', 'click'].forEach(type => el.addEventListener(type, directLogout, { capture: true, passive: false }));
    }
    if (isLoginElement(el) && el.dataset.hhFirebaseR68 !== 'login') {
      el.dataset.hhFirebaseR68 = 'login';
      el.disabled = false;
      el.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
      el.style.pointerEvents = 'auto';
      el.style.touchAction = 'manipulation';
      ['touchend', 'pointerup', 'click'].forEach(type => el.addEventListener(type, event => directLogin(event, el), { capture: true, passive: false }));
    }
  }

  function scan() {
    document.querySelectorAll('button,a,[role="button"],.btn,.btn-soft,.btn-primary').forEach(bindElement);
    if (window.HH) window.HH.logout = directLogout;
  }

  const capture = event => {
    const path = event.composedPath?.() || [];
    const candidate = path.find(el => isLogoutElement(el) || isLoginElement(el));
    if (isLogoutElement(candidate)) return directLogout(event);
    if (isLoginElement(candidate)) return directLogin(event, candidate);
  };

  ['touchend', 'pointerup', 'click'].forEach(type => document.addEventListener(type, capture, { capture: true, passive: false }));
  document.addEventListener('submit', event => {
    const info = findLoginForm(event.target);
    if (!info) return;
    const button = info.form.querySelector('button[type="submit"],.btn-primary,button');
    if (button && isLoginElement(button)) directLogin(event, button);
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
