/* /herohealth/firebase-config.js
   FULL PATCH v20260328-FIREBASE-CONFIG-BATTLE-READY
   - ใช้ได้กับ Firebase compat SDK
   - expose config ให้ไฟล์อื่นเรียกใช้ได้
   - มี helper signInAnonymously
   - ใช้ได้กับ lobby / battle run / duel / race / coop
*/
(function () {
  'use strict';

  const CONFIG = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55",
    measurementId: "G-T5J8DC0BKD"
  };

  window.HHA_FIREBASE_CONFIG = CONFIG;
  window.__HHA_FIREBASE_CONFIG__ = CONFIG;
  window.HHA_FIREBASE_READY = false;
  window.HHA_FIREBASE_ERROR = '';

  function log() {
    try { console.log.apply(console, arguments); } catch (_) {}
  }

  function warn() {
    try { console.warn.apply(console, arguments); } catch (_) {}
  }

  function fail(msg, err) {
    window.HHA_FIREBASE_READY = false;
    window.HHA_FIREBASE_ERROR = String(msg || 'Firebase init failed');
    try {
      console.error('[firebase-config]', msg, err || '');
    } catch (_) {}
  }

  function getFirebaseCompat() {
    const fb = window.firebase;
    if (!fb) return null;
    if (typeof fb.initializeApp !== 'function') return null;
    return fb;
  }

  function ensureApp() {
    const firebase = getFirebaseCompat();
    if (!firebase) {
      fail('firebase compat sdk missing');
      return null;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(CONFIG);
        log('[firebase-config] initializeApp ok');
      } else {
        log('[firebase-config] reuse existing app');
      }
    } catch (err) {
      const msg = String(err && err.message || err || '');
      if (/already exists|already been created/i.test(msg)) {
        log('[firebase-config] app already exists, reuse');
      } else {
        fail('initializeApp failed', err);
        return null;
      }
    }

    try {
      const ok = !!(firebase.apps && firebase.apps.length);
      window.HHA_FIREBASE_READY = ok;
      if (!ok) {
        fail('firebase app not ready after init');
        return null;
      }
      return firebase;
    } catch (err) {
      fail('firebase app readiness check failed', err);
      return null;
    }
  }

  async function ensureAnonymousAuth() {
    const firebase = ensureApp();
    if (!firebase) throw new Error(window.HHA_FIREBASE_ERROR || 'firebase not ready');

    if (typeof firebase.auth !== 'function') {
      throw new Error('firebase auth compat sdk missing');
    }

    const auth = firebase.auth();

    if (auth.currentUser) return auth.currentUser;

    try {
      const cred = await auth.signInAnonymously();
      return (cred && cred.user) || auth.currentUser;
    } catch (err) {
      fail('anonymous auth failed', err);
      throw err;
    }
  }

  async function ensureDatabaseReady() {
    const firebase = ensureApp();
    if (!firebase) throw new Error(window.HHA_FIREBASE_ERROR || 'firebase not ready');

    if (typeof firebase.database !== 'function') {
      throw new Error('firebase database compat sdk missing');
    }

    try {
      return firebase.database();
    } catch (err) {
      fail('database init failed', err);
      throw err;
    }
  }

  window.HHA_getFirebase = function () {
    return ensureApp();
  };

  window.HHA_ensureAnonymousAuth = ensureAnonymousAuth;
  window.HHA_ensureDatabaseReady = ensureDatabaseReady;

  const firebase = ensureApp();
  if (!firebase) return;

  try {
    if (typeof firebase.auth === 'function') {
      firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          log('[firebase-config] auth ready uid=', user.uid);
        }
      });
    } else {
      warn('[firebase-config] firebase-auth compat sdk not loaded yet');
    }
  } catch (err) {
    warn('[firebase-config] onAuthStateChanged bind failed', err);
  }

  log('[firebase-config] ready =', window.HHA_FIREBASE_READY);
})();