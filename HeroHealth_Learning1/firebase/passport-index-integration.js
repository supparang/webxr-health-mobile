import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260804-firebase-login-r55';

const params = new URLSearchParams(location.search);
const mode = String(params.get('authority') || 'firebase').toLowerCase();
const enabled = mode === 'firebase' || mode === 'dual';
const STATE_KEY = 'herohealth_learning_platform_rc2';
const RELEASE = '20260804-PASSPORT-FIREBASE-LOGIN-PROGRESS-R55';

function readJson(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_) { return fallback; }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function same(a, b) {
  try { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
  catch (_) { return false; }
}

function mergeNested(base = {}, patch = {}) {
  const result = { ...base };
  Object.entries(patch || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeNested(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

function releaseOverlay() {
  document.querySelectorAll('#hh-sheet-login-status').forEach(node => node.remove());
  document.documentElement.dataset.hhLoginBusy = '0';
  document.documentElement.style.pointerEvents = 'auto';
  if (document.body) {
    document.body.style.overflow = '';
    document.body.style.pointerEvents = 'auto';
  }
  const app = document.getElementById('app');
  if (app) app.style.pointerEvents = 'auto';
}

function showBadge(text = 'Firebase • พร้อมตรวจสอบรหัส') {
  let node = document.getElementById('hh-firebase-authority-badge');
  if (!node) {
    node = document.createElement('div');
    node.id = 'hh-firebase-authority-badge';
    Object.assign(node.style, {
      position: 'fixed', left: '12px', bottom: '12px', zIndex: '99999',
      padding: '8px 11px', borderRadius: '999px', font: '700 12px system-ui',
      background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0',
      boxShadow: '0 8px 24px rgba(15,23,42,.14)', pointerEvents: 'none'
    });
    document.body.appendChild(node);
  }
  node.textContent = text;
}

function normalizeStudent(roster, sid) {
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

function studentIdFromContext() {
  const state = readJson(STATE_KEY, {});
  return String(
    params.get('studentId') || params.get('sid') || params.get('pid') ||
    state?.profile?.studentId || state?.pendingProfile?.studentId || ''
  ).trim();
}

async function hydrateFirebaseProgress(sid = studentIdFromContext(), reloadWhenChanged = true) {
  if (!sid) return false;
  showBadge(`Firebase • กำลังโหลดความคืบหน้าของ ${sid}`);
  const loaded = await HHFirebaseClient.loadProgress(sid);
  if (!loaded?.ok) throw new Error('firebase-passport-progress-load-failed');
  if (!loaded.exists || !loaded.progress) {
    showBadge(`Firebase • ${sid} • เริ่มภารกิจใหม่`);
    return false;
  }

  const remote = loaded.progress;
  const current = readJson(STATE_KEY, {});
  const before = {
    gameCompleted: current.gameCompleted || {},
    gameScores: current.gameScores || {},
    firebaseGameResults: current.firebaseGameResults || {},
    firebaseLastGame: current.firebaseLastGame || null
  };

  const next = {
    ...current,
    gameCompleted: mergeNested(current.gameCompleted || { hygiene: {}, nutrition: {}, fitness: {} }, remote.gameCompleted || {}),
    gameScores: mergeNested(current.gameScores || {}, Object.fromEntries(
      Object.entries(remote.gameResults || {}).map(([gameId, result]) => [gameId, Number(result?.score || 0)])
    )),
    firebaseGameResults: mergeNested(current.firebaseGameResults || {}, remote.gameResults || {}),
    firebaseLastGame: remote.lastGame || current.firebaseLastGame || null,
    firebaseAuthority: {
      mode: 'firebase', uid: loaded.user?.uid || '', studentId: sid,
      progressPath: loaded.path, hydratedAt: new Date().toISOString(), release: RELEASE
    }
  };

  const after = {
    gameCompleted: next.gameCompleted,
    gameScores: next.gameScores,
    firebaseGameResults: next.firebaseGameResults,
    firebaseLastGame: next.firebaseLastGame
  };

  if (!same(before, after)) {
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    showBadge(`Firebase • ${sid} • อัปเดตความคืบหน้าแล้ว`);
    console.info('[HeroHealth Firebase R55] progress applied', { studentId: sid, path: loaded.path });
    if (reloadWhenChanged) {
      const url = new URL(location.href);
      url.searchParams.set('authority', 'firebase');
      url.searchParams.set('studentId', sid);
      url.searchParams.set('sid', sid);
      url.searchParams.set('firebaseReady', '1');
      url.searchParams.set('firebaseProgressApplied', String(Date.now()));
      location.replace(url.href);
    }
    return true;
  }

  showBadge(`Firebase • ${sid} • ความคืบหน้าเป็นปัจจุบัน`);
  return false;
}

function setLoginCopy() {
  const app = document.getElementById('app');
  if (!app) return;
  const form = app.querySelector('form');
  if (!form) return;
  const desc = form.querySelector('p.muted');
  if (desc) desc.textContent = 'ระบบจะตรวจรหัส ชื่อ ห้อง กลุ่ม และความคืบหน้าจาก Firebase โดยอัตโนมัติ';
  const button = form.querySelector('button[type="submit"],button.btn-primary');
  if (button && !button.disabled) button.textContent = 'ตรวจสอบและเข้าสู่ภารกิจ';
}

async function firebaseLogin(form) {
  const input = form.querySelector('[name="studentId"],input');
  const sid = String(input?.value || '').trim().replace(/\s+/g, '');
  if (!sid) return;

  const button = form.querySelector('button[type="submit"],button.btn-primary');
  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังตรวจสอบจาก Firebase…';
  }
  showBadge(`Firebase • กำลังตรวจสอบรหัส ${sid}`);

  try {
    const rosterResult = await HHFirebaseClient.readRoster(sid);
    if (!rosterResult.ok) {
      throw new Error(rosterResult.reason === 'student-not-found'
        ? 'ไม่พบรหัสนี้ใน Firebase roster'
        : rosterResult.reason === 'student-inactive'
          ? 'รหัสนี้ถูกปิดใช้งานใน Firebase'
          : 'ตรวจสอบรหัสจาก Firebase ไม่สำเร็จ');
    }

    const profile = normalizeStudent(rosterResult.roster || {}, sid);
    const current = readJson(STATE_KEY, {});
    const next = {
      ...current,
      profile,
      pendingProfile: null,
      group: profile.group,
      view: 'student',
      gameCompleted: current.gameCompleted || { hygiene: {}, nutrition: {}, fitness: {} },
      completed: current.completed || { pretest: false, hygiene: false, nutrition: false, fitness: false, posttest: false, reflection: false },
      firebaseAuthority: {
        mode: 'firebase', uid: rosterResult.user?.uid || '', studentId: sid,
        rosterPath: rosterResult.rosterPath || '', loggedInAt: new Date().toISOString(), release: RELEASE
      }
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    localStorage.setItem('herohealth_active_student_id', sid);
    localStorage.setItem('HH_AUTHORITY_MODE', 'firebase');
    sessionStorage.setItem('HH_AUTHORITY_MODE', 'firebase');

    await HHFirebaseClient.bindStudent(sid);
    await hydrateFirebaseProgress(sid, false);

    const url = new URL(location.href);
    url.searchParams.set('authority', 'firebase');
    url.searchParams.set('studentId', sid);
    url.searchParams.set('sid', sid);
    url.searchParams.set('firebaseReady', '1');
    url.searchParams.set('firebaseLogin', '1');
    location.replace(url.href);
  } catch (error) {
    console.error('[HeroHealth Firebase R55] login failed', error);
    showBadge(`Firebase • ${error.message || 'ตรวจสอบรหัสไม่สำเร็จ'}`);
    alert(error.message || 'ตรวจสอบรหัสจาก Firebase ไม่สำเร็จ');
    if (button) {
      button.disabled = false;
      button.textContent = 'ตรวจสอบและเข้าสู่ภารกิจ';
    }
  } finally {
    releaseOverlay();
  }
}

function installFirebaseLoginBridge() {
  document.addEventListener('submit', event => {
    if (!enabled) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.querySelector('[name="studentId"],input')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    firebaseLogin(form);
  }, true);

  const app = document.getElementById('app');
  if (app) new MutationObserver(setLoginCopy).observe(app, { childList: true, subtree: true });
  setLoginCopy();
  console.info('[HeroHealth Firebase R55] Firebase login bridge installed');
}

if (enabled) {
  document.documentElement.dataset.hhAuthority = mode;
  window.HH_AUTHORITY_MODE = mode;
  window.HH_DISABLE_SHEET_RESUME = mode === 'firebase';
  sessionStorage.setItem('HH_AUTHORITY_MODE', mode);
  localStorage.setItem('HH_AUTHORITY_MODE', mode);

  const boot = async () => {
    releaseOverlay();
    installFirebaseLoginBridge();
    const sid = studentIdFromContext();
    if (sid) {
      try { await hydrateFirebaseProgress(sid); }
      catch (error) {
        console.error('[HeroHealth Firebase R55] hydrate failed', error);
        showBadge('Firebase • โหลดความคืบหน้าไม่สำเร็จ');
      }
    } else {
      showBadge('Firebase • พร้อมตรวจสอบรหัสนักเรียน');
    }
    releaseOverlay();
    [150, 600, 1500].forEach(delay => setTimeout(releaseOverlay, delay));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
