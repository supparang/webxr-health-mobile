/* /herohealth/firebase-config.js
   Firebase compat bootstrap - FINAL MATCHED
   For HeroHealth run pages using window.firebase + anonymous auth
   + expose Apps Script endpoint for HeroHealth logger
*/
(function () {
  'use strict';

  const W = window;

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

  // ===== HeroHealth Apps Script ingest =====
  // ใส่ endpoint จริงของคุณตรงนี้
  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxkMfe1Bm5RNsK8Se6VH5n7sUuXr0CVJTARZROhx_CbimrpJKKQzvTtzOpKbPGYPtaDVw/exec";

  // ถ้ายังไม่ได้ใช้ secret ให้ปล่อยว่างได้
  const INGEST_SECRET = "";

  let authReadyPromise = null;
  let anonAuthPromise = null;

  function exposeConfig() {
    W.HHA_FIREBASE_CONFIG = CONFIG;
    W.__HHA_FIREBASE_CONFIG__ = CONFIG;
    W.HEROHEALTH_FIREBASE_CONFIG = CONFIG;
    W.FIREBASE_CONFIG = CONFIG;

    // expose Apps Script endpoint ให้ logger ใช้
    W.HHA_APPS_SCRIPT_URL = APPS_SCRIPT_URL;
    W.HHA_INGEST_SECRET = INGEST_SECRET;
  }

  function getFirebase() {
    return W.firebase || null;
  }

  function getApp() {
    const firebase = getFirebase();
    if (!firebase) return null;
    try {
      if (firebase.apps && firebase.apps.length) return firebase.app();
    } catch (_) {}
    return null;
  }

  function bootstrapCompat() {
    exposeConfig();

    const firebase = getFirebase();
    if (!firebase) {
      W.HHA_FIREBASE_READY = false;
      console.error('[firebase-config] firebase compat sdk missing');
      return false;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(CONFIG);
        console.log('[firebase-config] initializeApp ok');
      } else {
        console.log('[firebase-config] reuse existing app');
      }

      W.HHA_FIREBASE_READY = true;
      return true;
    } catch (err) {
      try {
        if (firebase.apps && firebase.apps.length) {
          W.HHA_FIREBASE_READY = true;
          console.log('[firebase-config] initializeApp already exists, reuse app');
          return true;
        }
      } catch (_) {}

      W.HHA_FIREBASE_READY = false;
      console.error('[firebase-config] init failed:', err);
      return false;
    }
  }

  function waitForAuthReady(timeoutMs = 10000) {
    exposeConfig();

    if (authReadyPromise) return authReadyPromise;

    authReadyPromise = new Promise((resolve, reject) => {
      const startedAt = Date.now();

      function step() {
        const firebase = getFirebase();
        const ok = bootstrapCompat();

        if (!firebase || !ok) {
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error('Firebase compat not ready'));
            return;
          }
          setTimeout(step, 120);
          return;
        }

        try {
          const auth = firebase.auth();
          let settled = false;

          const unsub = auth.onAuthStateChanged(
            function (user) {
              if (settled) return;
              settled = true;
              try { unsub && unsub(); } catch (_) {}
              resolve(user || null);
            },
            function (err) {
              if (settled) return;
              settled = true;
              try { unsub && unsub(); } catch (_) {}
              reject(err);
            }
          );

          setTimeout(function () {
            if (settled) return;
            settled = true;
            try { unsub && unsub(); } catch (_) {}
            resolve(auth.currentUser || null);
          }, 1200);
        } catch (err) {
          reject(err);
        }
      }

      step();
    });

    return authReadyPromise;
  }

  async function ensureAnonymousAuth() {
    exposeConfig();

    if (anonAuthPromise) return anonAuthPromise;

    anonAuthPromise = (async () => {
      const ok = bootstrapCompat();
      if (!ok) {
        throw new Error('Firebase not initialized');
      }

      const firebase = getFirebase();
      if (!firebase) {
        throw new Error('Firebase sdk unavailable');
      }

      const auth = firebase.auth();

      if (auth.currentUser) {
        return auth.currentUser;
      }

      await waitForAuthReady().catch(() => null);

      if (auth.currentUser) {
        return auth.currentUser;
      }

      try {
        await auth.signInAnonymously();
      } catch (err) {
        console.error('[firebase-config] anonymous auth failed:', err);
        throw err;
      }

      await waitForAuthReady().catch(() => null);

      if (!auth.currentUser) {
        throw new Error('Anonymous auth finished without currentUser');
      }

      return auth.currentUser;
    })();

    try {
      return await anonAuthPromise;
    } finally {
      anonAuthPromise = null;
    }
  }

  function getDatabase() {
    const ok = bootstrapCompat();
    if (!ok) return null;

    const firebase = getFirebase();
    if (!firebase) return null;

    try {
      return firebase.database();
    } catch (err) {
      console.error('[firebase-config] database unavailable:', err);
      return null;
    }
  }

  function getAuth() {
    const ok = bootstrapCompat();
    if (!ok) return null;

    const firebase = getFirebase();
    if (!firebase) return null;

    try {
      return firebase.auth();
    } catch (err) {
      console.error('[firebase-config] auth unavailable:', err);
      return null;
    }
  }

  function getAppSafe() {
    bootstrapCompat();
    return getApp();
  }

  exposeConfig();

  W.HHA_bootstrapFirebaseCompat = bootstrapCompat;
  W.HHA_waitForFirebaseReady = waitForAuthReady;
  W.HHA_ensureAnonymousAuth = ensureAnonymousAuth;
  W.HHA_getFirebaseApp = getAppSafe;
  W.HHA_getFirebaseAuth = getAuth;
  W.HHA_getFirebaseDatabase = getDatabase;

  bootstrapCompat();

  console.log('[firebase-config] ready =', !!W.HHA_FIREBASE_READY);
  console.log('[firebase-config] appsScript =', W.HHA_APPS_SCRIPT_URL || '(missing)');
})();