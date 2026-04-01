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

      function waitForUser(timeoutMs = 8000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('anonymous auth timeout')), timeoutMs);
          const off = a.onAuthStateChanged((user) => {
            if (!user) return;
            clearTimeout(timer);
            try { off(); } catch(_) {}
            resolve(user);
          }, (err) => {
            clearTimeout(timer);
            try { off(); } catch(_) {}
            reject(err || new Error('anonymous auth failed'));
          });
        });
      }

      let user = a.currentUser;

      if (!user) {
        const cred = await a.signInAnonymously();
        user = (cred && cred.user) || null;
      }

      if (!user) {
        user = await waitForUser();
      }

      if (!user || !user.uid) {
        throw new Error('anonymous auth failed');
      }

      try {
        await user.getIdToken(true);
      } catch (_) {}

      await new Promise(resolve => setTimeout(resolve, 250));

      return a.currentUser || user;
    };

    WIN.HHA_debugFirebase = function () {
      const appNow = WIN.HHA_FIREBASE_APP || (firebase.apps && firebase.apps.length ? firebase.app() : null);
      const authNow = WIN.HHA_FIREBASE_AUTH || (typeof firebase.auth === 'function' ? firebase.auth() : null);
      const dbNow = WIN.HHA_FIREBASE_DB || (typeof firebase.database === 'function' ? firebase.database() : null);

      const out = {
        ready: !!WIN.HHA_FIREBASE_READY,
        error: WIN.HHA_FIREBASE_ERROR || '',
        hasFirebase: !!WIN.firebase,
        appCount: firebase.apps ? firebase.apps.length : -1,
        appName: appNow && appNow.name ? appNow.name : '',
        databaseURL: appNow && appNow.options ? appNow.options.databaseURL : '',
        authUid: authNow && authNow.currentUser ? authNow.currentUser.uid : '',
        authIsAnonymous: !!(authNow && authNow.currentUser && authNow.currentUser.isAnonymous),
        hasDb: !!dbNow
      };

      console.log('[HHA_debugFirebase]', out);
      return out;
    };

    console.log('[firebase-config] initializeApp ok');
    console.log('[firebase-config] ready =', !!WIN.HHA_FIREBASE_READY);
    console.log('[firebase-config] databaseURL =', app && app.options ? app.options.databaseURL : '');
    console.log('[firebase-config] auth uid =', auth && auth.currentUser ? auth.currentUser.uid : '(not-yet)');

    emitReady(true, {
      appName: app && app.name ? app.name : '[DEFAULT]'
    });
  } catch (err) {
    setError((err && err.message) ? err.message : String(err || 'firebase init failed'));
  }
})();