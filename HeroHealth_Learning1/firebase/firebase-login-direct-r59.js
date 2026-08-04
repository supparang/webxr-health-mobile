import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260804-firebase-login-direct-r60';

(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mode = String(params.get('authority') || 'firebase').toLowerCase();
  if (mode !== 'firebase' && mode !== 'dual') return;

  const STATE_KEY = 'herohealth_learning_platform_rc2';
  const ACTIVE_KEY = 'herohealth_active_student_id';
  const RELEASE = '20260804-FIREBASE-LOGIN-DIRECT-R60-REBUILD-PROGRESS';
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

  function truthyResult(result) {
    return Boolean(result && (result.completed === true || result.passed === true || result.progressionEligible === true));
  }

  function rebuildProgress(remote = {}, existing = {}) {
    const gameResults = remote.gameResults || {};
    const raw = mergeNested(existing.gameCompleted || { hygiene: {}, nutrition: {}, fitness: {} }, remote.gameCompleted || {});

    const aliases = {
      handwash: ['handwash'],
      toothbrush: ['toothbrush', 'brush'],
      groups: ['groups', 'foodgroups', 'food-groups'],
      goodjunk: ['goodjunk', 'good-junk'],
      jumpduck: ['jumpduck', 'jump-duck'],
      balance: ['balance', 'balancehold', 'balance-hold']
    };
    const zoneFor = { handwash: 'hygiene', toothbrush: 'hygiene', groups: 'nutrition', goodjunk: 'nutrition', jumpduck: 'fitness', balance: 'fitness' };

    Object.entries(aliases).forEach(([canonical, ids]) => {
      const zone = zoneFor[canonical];
      raw[zone] = raw[zone] || {};
      const fromMap = ids.some(id => raw?.[zone]?.[id] === true);
      const fromResult = ids.some(id => truthyResult(gameResults[id]));
      if (fromMap || fromResult) raw[zone][canonical] = true;
    });

    const assessmentPre = remote.pretestCompleted === true || remote.assessments?.pretest?.completed === true;
    const assessmentPost = remote.posttestCompleted === true || remote.assessments?.posttest?.completed === true;
    const completed = {
      ...(existing.completed || {}),
      pretest: assessmentPre,
      hygiene: raw.hygiene?.handwash === true && raw.hygiene?.toothbrush === true,
      nutrition: raw.nutrition?.groups === true && raw.nutrition?.goodjunk === true,
      fitness: raw.fitness?.jumpduck === true && raw.fitness?.balance === true,
      posttest: assessmentPost
    };

    return {
      completed,
      gameCompleted: raw,
      pretestCompleted: assessmentPre,
      posttestCompleted: assessmentPost,
      gameScores: mergeNested(existing.gameScores || {}, Object.fromEntries(
        Object.entries(gameResults).map(([id, result]) => [id, Number(result?.score || 0)])
      )),
      firebaseGameResults: mergeNested(existing.firebaseGameResults || {}, gameResults),
      firebaseLastGame: remote.lastGame || existing.firebaseLastGame || null,
      firebaseAssessments: mergeNested(existing.firebaseAssessments || {}, remote.assessments || {})
    };
  }

  function loginFormFrom(node) {
    const form = node?.closest?.('form');
    if (!form) return null;
    const input = form.querySelector('[name="studentId"], input[inputmode="numeric"], input');
    return input ? { form, input } : null;
  }

  function isLoginButton(node) {
    const button = node?.closest?.('button');
    if (!button) return null;
    const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    return (text.includes('ตรวจสอบ') || text.includes('เข้าสู่ภารกิจ')) && loginFormFrom(button) ? button : null;
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
    if (!sid) { input?.focus(); return; }

    busy = true;
    setStatus(button, 'กำลังกู้ความคืบหน้าจาก Firebase…', true);

    try {
      const rosterResult = await HHFirebaseClient.readRoster(sid);
      if (!rosterResult?.ok) {
        throw new Error(rosterResult?.reason === 'student-not-found' ? 'ไม่พบรหัสนี้ใน Firebase roster' : rosterResult?.reason === 'student-inactive' ? 'รหัสนี้ถูกปิดใช้งาน' : 'ตรวจสอบรหัสจาก Firebase ไม่สำเร็จ');
      }

      await HHFirebaseClient.bindStudent(sid);
      const loaded = await HHFirebaseClient.loadProgress(sid);
      const profile = normalizeRoster(rosterResult.roster || {}, sid);
      const current = readState();
      const recovered = loaded?.ok && loaded.exists && loaded.progress
        ? rebuildProgress(loaded.progress, current)
        : rebuildProgress({}, current);

      const next = {
        ...current,
        ...recovered,
        profile,
        pendingProfile: null,
        group: profile.group,
        view: 'student',
        firebaseAuthority: {
          mode: 'firebase',
          uid: rosterResult.user?.uid || loaded?.user?.uid || '',
          studentId: sid,
          rosterPath: rosterResult.rosterPath || '',
          progressPath: loaded?.path || '',
          progressExists: loaded?.exists === true,
          hydratedAt: new Date().toISOString(),
          release: RELEASE
        }
      };

      localStorage.setItem(STATE_KEY, JSON.stringify(next));
      localStorage.setItem(ACTIVE_KEY, sid);
      localStorage.setItem('HH_AUTHORITY_MODE', 'firebase');
      sessionStorage.setItem('HH_AUTHORITY_MODE', 'firebase');

      console.info('[HeroHealth Firebase Login R60] progress rebuilt', {
        studentId: sid,
        path: loaded?.path,
        pretest: next.completed?.pretest,
        gameCompleted: next.gameCompleted,
        completed: next.completed
      });

      const url = new URL(location.href);
      ['logout','logoutAt'].forEach(key => url.searchParams.delete(key));
      url.searchParams.set('authority', 'firebase');
      url.searchParams.set('studentId', sid);
      url.searchParams.set('sid', sid);
      url.searchParams.set('firebaseReady', '1');
      url.searchParams.set('firebaseLoginDirect', '1');
      url.searchParams.set('firebaseHydrated', String(Date.now()));
      url.searchParams.set('v', '20260804-login-direct-r60');
      location.replace(url.href);
    } catch (error) {
      console.error('[HeroHealth Firebase Login R60]', error);
      alert(error?.message || 'กู้ความคืบหน้าจาก Firebase ไม่สำเร็จ');
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
    directLogin(info.form, info.form.querySelector('button[type="submit"], button.btn-primary'));
  }, true);

  console.info('[HeroHealth Firebase Login R60] receipt-based progress recovery installed');
})();
