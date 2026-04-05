(function (W) {
  'use strict';

  const CONFIG = W.HHA_FIREBASE_CONFIG || {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55",
    measurementId: "G-T5J8DC0BKD"
  };

  W.HHA_FIREBASE_CONFIG = CONFIG;
  W.HEROHEALTH_FIREBASE_CONFIG = CONFIG;
  W.FIREBASE_CONFIG = CONFIG;
  W.__firebaseConfig = CONFIG;

  W.HHA_FIREBASE_READY = false;
  W.HHA_FIREBASE_ERROR = '';
  W.HHA_FIREBASE_APP = null;
  W.HHA_FIREBASE_DB = null;
  W.HHA_FIREBASE_AUTH = null;
  W.HHA_FIREBASE_USER = null;
  W.HHA_FIREBASE_UID = '';

  let ensureAuthPromise = null;
  let emittedReady = false;

  function emitReady(ok, error) {
    try {
      W.dispatchEvent(new CustomEvent('hha:firebase_ready', {
        detail: { ok: !!ok, error: String(error || '') }
      }));
    } catch (_) {}
  }

  function setError(err) {
    const msg = err && err.message ? err.message : String(err || 'firebase error');
    W.HHA_FIREBASE_ERROR = msg;
    console.error('[HHA] Firebase error:', msg);
    emitReady(false, msg);
    return msg;
  }

  function markReady(user) {
    if (!user || !user.uid) return null;

    W.HHA_FIREBASE_USER = user;
    W.HHA_FIREBASE_UID = user.uid;
    W.HHA_FIREBASE_READY = true;
    W.HHA_FIREBASE_ERROR = '';

    if (!emittedReady) {
      emittedReady = true;
      console.log('[HHA] Firebase ready:', user.uid);
      emitReady(true, '');
    }

    return user;
  }

  async function waitForAuthUser(auth, timeoutMs = 15000) {
    if (auth.currentUser && auth.currentUser.uid) {
      return auth.currentUser;
    }

    return await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('anonymous auth timeout'));
      }, timeoutMs);

      const off = auth.onAuthStateChanged((u) => {
        if (done) return;
        if (!u || !u.uid) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch (_) {}
        resolve(u);
      }, (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch (_) {}
        reject(err || new Error('auth state failed'));
      });
    });
  }

  async function ensureAnonymousAuth() {
    if (W.HHA_FIREBASE_READY && W.HHA_FIREBASE_UID) {
      return W.HHA_FIREBASE_USER || { uid: W.HHA_FIREBASE_UID };
    }

    const auth = W.HHA_FIREBASE_AUTH;
    if (!auth) {
      throw new Error('firebase auth not ready');
    }

    if (auth.currentUser && auth.currentUser.uid) {
      return markReady(auth.currentUser);
    }

    if (ensureAuthPromise) return ensureAuthPromise;

    ensureAuthPromise = (async () => {
      try {
        await auth.signInAnonymously();
        const user = await waitForAuthUser(auth, 15000);
        return markReady(user);
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        ensureAuthPromise = null;
      }
    })();

    return ensureAuthPromise;
  }

  W.HHA_ensureAnonymousAuth = ensureAnonymousAuth;

  if (!W.firebase) {
    setError('Firebase SDK not loaded');
    return;
  }

  try {
    const app = (firebase.apps && firebase.apps.length)
      ? firebase.app()
      : firebase.initializeApp(CONFIG);

    const db = firebase.database(app);
    const auth = firebase.auth(app);

    W.HHA_FIREBASE_APP = app;
    W.HHA_FIREBASE_DB = db;
    W.HHA_FIREBASE_AUTH = auth;

    auth.onAuthStateChanged((user) => {
      try {
        if (user && user.uid) {
          markReady(user);
          return;
        }
      } catch (err) {
        setError(err);
      }
    }, (err) => {
      setError(err);
    });

    setTimeout(() => {
      if (!W.HHA_FIREBASE_READY) {
        ensureAnonymousAuth().catch((err) => {
          setError(err);
        });
      }
    }, 250);

    try {
      console.log('[firebase-config] loaded', CONFIG.projectId);
    } catch (_) {}
  } catch (err) {
    setError(err);
  }
})(window);