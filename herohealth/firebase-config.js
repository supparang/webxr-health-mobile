(function () {
  'use strict';

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

  window.HHA_FIREBASE_CONFIG = firebaseConfig;

  function markReady(ok, error) {
    try {
      window.dispatchEvent(new CustomEvent('hha:firebase_ready', {
        detail: {
          ok: !!ok,
          error: error ? String(error) : ''
        }
      }));
    } catch (_) {}
  }

  function ensureFirebaseDb() {
    if (!window.firebase) {
      throw new Error('Firebase SDK not loaded');
    }

    let app = null;
    if (window.firebase.apps && window.firebase.apps.length) {
      app = window.firebase.app();
    } else {
      app = window.firebase.initializeApp(firebaseConfig);
    }

    const db = window.firebase.database(app);
    window.HHA_FIREBASE = window.firebase;
    window.HHA_FIREBASE_APP = app;
    window.HHA_FIREBASE_DB = db;
    return db;
  }

  window.HHA_ENSURE_FIREBASE_DB = function () {
    if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;
    return ensureFirebaseDb();
  };

  window.HHA_ensureAnonymousAuth = async function () {
    const db = window.HHA_ENSURE_FIREBASE_DB();
    void db;

    if (!window.firebase || typeof window.firebase.auth !== 'function') {
      throw new Error('Firebase Auth not available');
    }

    const auth = window.firebase.auth();
    if (auth.currentUser && auth.currentUser.uid) {
      return auth.currentUser;
    }

    await auth.signInAnonymously();

    return await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('Anonymous auth timeout'));
      }, 12000);

      const off = auth.onAuthStateChanged((user) => {
        if (done) return;
        if (user && user.uid) {
          done = true;
          clearTimeout(timer);
          try { off(); } catch (_) {}
          resolve(user);
        }
      }, (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch (_) {}
        reject(err || new Error('Auth state failed'));
      });
    });
  };

  function bootWhenReady() {
    try {
      if (!window.firebase) {
        return false;
      }
      window.HHA_ENSURE_FIREBASE_DB();
      markReady(true, '');
      return true;
    } catch (err) {
      console.warn('[HHA] Firebase boot failed:', err);
      markReady(false, err && err.message ? err.message : err);
      return false;
    }
  }

  if (!bootWhenReady()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (bootWhenReady() || tries >= 80) {
        clearInterval(timer);
      }
    }, 150);
  }
})();