/* /herohealth/firebase-config.js
   Firebase compat bootstrap - FINAL MATCHED
   PATCH v20260411a-GJ-DUET-AUTH-HARDFAIL
*/
(function () {
  'use strict';

  const W = window;

  const CONFIG = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    projectId: "herohealth-d7f8c",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app"
  };

  W.HHA_FIREBASE_CONFIG = CONFIG;
  W.HEROHEALTH_FIREBASE_CONFIG = CONFIG;
  W.FIREBASE_CONFIG = CONFIG;
  W.__firebaseConfig = CONFIG;

  function makeCtx(app, auth, db) {
    return {
      app,
      auth,
      db,
      config: CONFIG,
      ready: !!(app && auth && db)
    };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForAuthUser(auth, timeoutMs = 10000) {
    if (!auth) throw new Error('Firebase Auth compat not available');
    if (auth.currentUser) return auth.currentUser;

    return await new Promise((resolve, reject) => {
      let done = false;
      let off = null;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { if (off) off(); } catch (_) {}
        reject(new Error('Anonymous auth timeout'));
      }, timeoutMs);

      off = auth.onAuthStateChanged(
        (user) => {
          if (!user || done) return;
          done = true;
          clearTimeout(timer);
          try { if (off) off(); } catch (_) {}
          resolve(user);
        },
        (err) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { if (off) off(); } catch (_) {}
          reject(err || new Error('Auth state observer failed'));
        }
      );
    });
  }

  async function initFirebaseCompat() {
    if (!W.firebase) {
      throw new Error('Firebase compat SDK not loaded');
    }

    const fb = W.firebase;

    let app;
    try {
      app = (fb.apps && fb.apps.length)
        ? fb.app()
        : fb.initializeApp(CONFIG);
    } catch (err) {
      if (fb.apps && fb.apps.length) {
        app = fb.app();
      } else {
        throw err;
      }
    }

    const auth = (fb.auth && typeof fb.auth === 'function')
      ? fb.auth()
      : null;

    const db = (fb.database && typeof fb.database === 'function')
      ? fb.database()
      : null;

    if (!auth) throw new Error('Firebase Auth compat not available');
    if (!db) throw new Error('Firebase Realtime Database compat not available');

    if (!auth.currentUser) {
      if (typeof auth.signInAnonymously !== 'function') {
        throw new Error('signInAnonymously is not available');
      }
      try {
        await auth.signInAnonymously();
      } catch (err) {
        console.warn('[HeroHealth Firebase] signInAnonymously failed:', err && err.message ? err.message : err);
        throw err;
      }
    }

    await waitForAuthUser(auth, 10000);

    const ctx = makeCtx(app, auth, db);
    W.HHA_FIREBASE = ctx;
    return ctx;
  }

  W.HHA_FIREBASE_READY = (async () => {
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db && W.HHA_FIREBASE.auth) {
      await waitForAuthUser(W.HHA_FIREBASE.auth, 10000);
      return W.HHA_FIREBASE;
    }

    let lastErr = null;

    try {
      return await initFirebaseCompat();
    } catch (firstErr) {
      lastErr = firstErr;
      const start = Date.now();
      const timeoutMs = 10000;

      while ((Date.now() - start) < timeoutMs) {
        await delay(150);

        if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db && W.HHA_FIREBASE.auth) {
          try {
            await waitForAuthUser(W.HHA_FIREBASE.auth, 4000);
            return W.HHA_FIREBASE;
          } catch (err) {
            lastErr = err;
          }
        }

        if (W.firebase) {
          try {
            return await initFirebaseCompat();
          } catch (err) {
            lastErr = err;
          }
        }
      }

      throw lastErr || firstErr;
    }
  })();

})();