import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260804-passport-progress-hydrator-r54';

const params = new URLSearchParams(location.search);
const mode = String(params.get('authority') || 'sheet').toLowerCase();
const enabled = mode === 'firebase' || mode === 'dual';
const STATE_KEY = 'herohealth_learning_platform_rc2';
const RELEASE = '20260804-PASSPORT-FIREBASE-PROGRESS-HYDRATOR-R54';

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

function showBadge(text = 'Firebase • กำลังตรวจความคืบหน้า') {
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

function studentIdFromContext() {
  const state = readJson(STATE_KEY, {});
  return String(
    params.get('studentId') || params.get('sid') || params.get('pid') ||
    state?.profile?.studentId || state?.pendingProfile?.studentId || '990014'
  ).trim();
}

async function hydrateFirebaseProgress() {
  const sid = studentIdFromContext();
  if (!sid) throw new Error('firebase-passport-student-required');

  showBadge(`Firebase • กำลังโหลดความคืบหน้าของ ${sid}`);
  const loaded = await HHFirebaseClient.loadProgress(sid);
  if (!loaded?.ok) throw new Error('firebase-passport-progress-load-failed');
  if (!loaded.exists || !loaded.progress) {
    showBadge(`Firebase • ${sid} • ยังไม่มีผลเกม`);
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
      mode: 'firebase',
      uid: loaded.user?.uid || '',
      studentId: sid,
      progressPath: loaded.path,
      hydratedAt: new Date().toISOString(),
      release: RELEASE
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
    const receipt = String(remote?.lastGame?.firebaseReceiptToken || remote?.gameResults?.handwash?.firebaseReceiptToken || Date.now());
    showBadge(`Firebase • ${sid} • อัปเดต Handwash แล้ว`);
    console.info('[HeroHealth Firebase Progress R54] applied', {
      studentId: sid,
      path: loaded.path,
      gameCompleted: remote.gameCompleted,
      receipt
    });

    const url = new URL(location.href);
    url.searchParams.set('authority', 'firebase');
    url.searchParams.set('studentId', sid);
    url.searchParams.set('sid', sid);
    url.searchParams.set('firebaseReady', '1');
    url.searchParams.set('firebaseProgressApplied', receipt.slice(0, 120));
    location.replace(url.href);
    return true;
  }

  showBadge(`Firebase • ${sid} • ความคืบหน้าเป็นปัจจุบัน`);
  console.info('[HeroHealth Firebase Progress R54] already current', {
    studentId: sid,
    path: loaded.path,
    gameCompleted: remote.gameCompleted
  });
  return false;
}

if (enabled) {
  document.documentElement.dataset.hhAuthority = mode;
  window.HH_AUTHORITY_MODE = mode;
  window.HH_DISABLE_SHEET_RESUME = mode === 'firebase';
  sessionStorage.setItem('HH_AUTHORITY_MODE', mode);
  localStorage.setItem('HH_AUTHORITY_MODE', mode);

  const boot = async () => {
    releaseOverlay();
    showBadge();
    try {
      await hydrateFirebaseProgress();
    } catch (error) {
      console.error('[HeroHealth Firebase Progress R54] hydrate failed', error);
      showBadge('Firebase • โหลดความคืบหน้าไม่สำเร็จ');
    } finally {
      releaseOverlay();
      [150, 600, 1500].forEach(delay => setTimeout(releaseOverlay, delay));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
