(function () {
  'use strict';

  const WIN = window;

  const firebaseConfig = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55",
    measurementId: "G-T5J8DC0BKD"
  };

  function emitReady(ok, extra) {
    try {
      WIN.dispatchEvent(new CustomEvent('hha:firebase_ready', {
        detail: Object.assign({ ok: !!ok }, extra || {})
      }));
    } catch (_) {}
  }

  function setError(message) {
    WIN.HHA_FIREBASE_READY = false;
    WIN.HHA_FIREBASE_ERROR = String(message || 'firebase init failed');
    console.error('[firebase-config]', WIN.HHA_FIREBASE_ERROR);
    emitReady(false, { error: WIN.HHA_FIREBASE_ERROR });
  }

  if (!WIN.firebase) {
    setError('Firebase SDK not loaded');
    return;
  }

  if (typeof firebase.initializeApp !== 'function') {
    setError('firebase.initializeApp unavailable');
    return;
  }

  if (typeof firebase.database !== 'function') {
    setError('firebase.database unavailable');
    return;
  }

  if (typeof firebase.auth !== 'function') {
    setError('firebase.auth unavailable');
    return;
  }

  try {
    const app = (firebase.apps && firebase.apps.length)
      ? firebase.app()
      : firebase.initializeApp(firebaseConfig);

    const db = firebase.database(app);
    const auth = firebase.auth(app);

    WIN.HHA_FIREBASE_APP = app;
    WIN.HHA_FIREBASE_DB = db;
    WIN.HHA_FIREBASE_AUTH = auth;
    WIN.HHA_FIREBASE_READY = true;
    WIN.HHA_FIREBASE_ERROR = '';

    WIN.HHA_ENSURE_FIREBASE_DB = function () {
      return WIN.HHA_FIREBASE_DB || firebase.database(app);
    };

    WIN.HHA_ensureAnonymousAuth = async function () {
      const a = WIN.HHA_FIREBASE_AUTH || firebase.auth(app);
      if (a.currentUser) return a.currentUser;

      const cred = await a.signInAnonymously();
      return (cred && cred.user) || a.currentUser;
    };

    console.log('[firebase-config] initializeApp ok');
    console.log('[firebase-config] ready =', !!WIN.HHA_FIREBASE_READY);

    emitReady(true, {
      appName: app && app.name ? app.name : '[DEFAULT]'
    });
  } catch (err) {
    setError((err && err.message) ? err.message : String(err || 'firebase init failed'));
  }
})();