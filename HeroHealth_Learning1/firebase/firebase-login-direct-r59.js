import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260804-firebase-login-direct-r59';

(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mode = String(params.get('authority') || 'firebase').toLowerCase();
  if (mode !== 'firebase' && mode !== 'dual') return;

  const STATE_KEY = 'herohealth_learning_platform_rc2';
  const ACTIVE_KEY = 'herohealth_active_student_id';
  let busy = false;

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function mergeNested(base = {}, patch = {}) {
    const out = { ...base };
    Object.entries(patch || {}).forEach(([key, value]) => {
      out[key] = value && typeof value === 'object' && !Array.isArray(value)
        ? mergeNested(out[key] || {}, value)
        : value;
    });
    return out;
  }

  function normalizeRoster(roster, sid) {
    const group = String(roster.group || roster.rotationGroup || roster.conditionGroup || 'A').trim();
    return {
      ...roster,
      studentId: sid,
      fullName: String(roster.fullName || roster.studentName || roster.name || roster.nickname || `นักเรียน ${sid}`),
      nickname: String(roster.nickname || roster.nick || ''),
      section: String(roster.section || roster.classId || roster.className || 'herohealth-pilot-2026'),
      group,
      rotationGroup: String(roster.rotationGroup || group),
      active: roster.active !== false
    };
  }

  function loginFormFrom(node) {
    const form = node?.closest?.('form');
    if (!form) return null;
    const input = form.querySelector('[name="studentId"], input[inputmode="numeric"], input');
    if (!input) return null;
    return { form, input };
  }

  function isLoginButton(node) {
    const button = node?.closest?.('button');
    if (!button) return null;
    const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text.includes('ตรวจสอบ') && !text.includes('เข้าสู่ภารกิจ')) return null;
    return loginFormFrom(button) ? button : null;
  }

  function setStatus(button, text, disabled = true) {
    if (!button) return;
    button.disabled = disabled;
    button.textContent = text;
  }

  async function directLogin(form, button) {
    if (busy) return;
    const input = form.querySelector('[name="studentId"], input[inputmode="numeric"], input');
    const sid = String(input?.value || '').trim().replace(/\s+/g, '');
    if (!sid) {
      input?.focus();
      return;
    }

    busy = true;
    setStatus(button, 'กำลังตรวจสอบจาก Firebase…', true);

    try {
      const rosterResult = await HHFirebaseClient.readRoster(sid);
      if (!rosterResult?.ok) {
        const message = rosterResult?.reason === 'student-not-found'
          ? 'ไม่พบรหัสนี้ใน Firebase roster'
          : rosterResult?.reason === 'student-inactive'
            ? 'รหัสนี้ถูกปิดใช้งาน'
            : 'ตรวจสอบรหัสจาก Firebase ไม่สำเร็จ';
        throw new Error(message);
      }

      const profile = normalizeRoster(rosterResult.roster || {}, sid);
      const current = readState();
      let next = {
        ...current,
        profile,
        pendingProfile: null,
        group: profile.group,
        view: 'student',
        completed: current.completed || {
          pretest: false, hygiene: false, nutrition: false,
          fitness: false, posttest: false, reflection: false
        },
        gameCompleted: current.gameCompleted || { hygiene: {}, nutrition: {}, fitness: {} },
        firebaseAuthority: {
          mode: 'firebase',
          uid: rosterResult.user?.uid || '',
          studentId: sid,
          rosterPath: rosterResult.rosterPath || '',
          loggedInAt: new Date().toISOString(),
          release: '20260804-FIREBASE-LOGIN-DIRECT-R59'
        }
      };

      await HHFirebaseClient.bindStudent(sid);
      const loaded = await HHFirebaseClient.loadProgress(sid);
      if (loaded?.ok && loaded.exists && loaded.progress) {
        const remote = loaded.progress;
        const completed = { ...(next.completed || {}) };
        if (remote.pretestCompleted === true) completed.pretest = true;
        if (remote.posttestCompleted === true) completed.posttest = true;
        next = {
          ...next,
          completed,
          pretestCompleted: remote.pretestCompleted === true,
          posttestCompleted: remote.posttestCompleted === true,
          gameCompleted: mergeNested(next.gameCompleted, remote.gameCompleted || {}),
          gameScores: mergeNested(next.gameScores || {}, Object.fromEntries(
            Object.entries(remote.gameResults || {}).map(([id, result]) => [id, Number(result?.score || 0)])
          )),
          firebaseGameResults: mergeNested(next.firebaseGameResults || {}, remote.gameResults || {}),
          firebaseLastGame: remote.lastGame || null
        };
      }

      localStorage.setItem(STATE_KEY, JSON.stringify(next));
      localStorage.setItem(ACTIVE_KEY, sid);
      localStorage.setItem('HH_AUTHORITY_MODE', 'firebase');
      sessionStorage.setItem('HH_AUTHORITY_MODE', 'firebase');

      const url = new URL(location.href);
      ['logout','logoutAt'].forEach(key => url.searchParams.delete(key));
      url.searchParams.set('authority', 'firebase');
      url.searchParams.set('studentId', sid);
      url.searchParams.set('sid', sid);
      url.searchParams.set('firebaseReady', '1');
      url.searchParams.set('firebaseLoginDirect', '1');
      url.searchParams.set('v', '20260804-login-direct-r59');
      location.replace(url.href);
    } catch (error) {
      console.error('[HeroHealth Firebase Login R59]', error);
      alert(error?.message || 'ตรวจสอบรหัสจาก Firebase ไม่สำเร็จ');
      setStatus(button, 'ตรวจสอบและเข้าสู่ภารกิจ', false);
      busy = false;
    }
  }

  function intercept(event) {
    const button = isLoginButton(event.target);
    if (!button) return;
    const info = loginFormFrom(button);
    if (!info) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    directLogin(info.form, button);
  }

  document.addEventListener('pointerup', intercept, true);
  document.addEventListener('click', intercept, true);
  document.addEventListener('submit', event => {
    const info = loginFormFrom(event.target);
    if (!info) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const button = info.form.querySelector('button[type="submit"], button.btn-primary');
    directLogin(info.form, button);
  }, true);

  console.info('[HeroHealth Firebase Login R59] direct mobile login bridge installed');
})();
