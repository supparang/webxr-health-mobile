// /herohealth/firebase-config.js
// FULL PATCH v20260327-GJBATTLE-AUTH-R1
(function () {
  'use strict';

  const W = window;

  const firebaseConfig = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55"
  };

  W.HHA_FIREBASE_CONFIG = firebaseConfig;
  W.__HHA_FIREBASE_CONFIG__ = firebaseConfig;
  W.firebaseConfig = firebaseConfig;

  W.HHA_FIREBASE_READY = false;
  W.HHA_FIREBASE_APP = null;
  W.HHA_FIREBASE_AUTH_READY = false;
  W.HHA_FIREBASE_UID = '';

  let authReadyResolve;
  let authReadyReject;

  W.HHA_FIREBASE_AUTH_READY_PROMISE = new Promise((resolve, reject) => {
    authReadyResolve = resolve;
    authReadyReject = reject;
  });

  function resolveAuthReady(uid) {
    W.HHA_FIREBASE_AUTH_READY = true;
    W.HHA_FIREBASE_UID = String(uid || '');
    try { authReadyResolve(uid); } catch (_) {}
    try {
      W.dispatchEvent(new CustomEvent('hha:firebase-auth-ready', {
        detail: { uid: W.HHA_FIREBASE_UID }
      }));
    } catch (_) {}
  }

  function rejectAuthReady(err) {
    W.HHA_FIREBASE_AUTH_READY = false;
    try { authReadyReject(err); } catch (_) {}
  }

  function initFirebaseCompat() {
    try {
      if (!W.firebase) {
        W.HHA_FIREBASE_READY = false;
        return false;
      }

      if (!W.firebase.apps || !W.firebase.apps.length) {
        W.HHA_FIREBASE_APP = W.firebase.initializeApp(firebaseConfig);
      } else {
        W.HHA_FIREBASE_APP = W.firebase.apps[0];
      }

      W.HHA_FIREBASE_READY = !!W.HHA_FIREBASE_APP;
      return W.HHA_FIREBASE_READY;
    } catch (err) {
      const msg = String(err && err.message || err || '');
      if (/already exists/i.test(msg)) {
        try {
          W.HHA_FIREBASE_APP = W.firebase.apps[0];
          W.HHA_FIREBASE_READY = true;
          return true;
        } catch (_) {}
      }
      console.error('[HHA] Firebase init failed:', err);
      W.HHA_FIREBASE_READY = false;
      return false;
    }
  }

  async function ensureAnonymousAuth() {
    if (!initFirebaseCompat()) {
      throw new Error('Firebase app ยังไม่พร้อม');
    }
    if (!W.firebase || typeof W.firebase.auth !== 'function') {
      throw new Error('Firebase Auth SDK ยังไม่ถูกโหลด');
    }

    const auth = W.firebase.auth();

    if (auth.currentUser && auth.currentUser.uid) {
      resolveAuthReady(auth.currentUser.uid);
      return auth.currentUser;
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const off = auth.onAuthStateChanged(async (user) => {
        if (user && user.uid) {
          if (!settled) {
            settled = true;
            resolveAuthReady(user.uid);
            resolve(user);
          }
          try { off(); } catch (_) {}
        }
      }, (err) => {
        console.error('[HHA] onAuthStateChanged error:', err);
        if (!settled) {
          settled = true;
          rejectAuthReady(err);
          reject(err);
        }
        try { off(); } catch (_) {}
      });

      auth.signInAnonymously().catch((err) => {
        console.error('[HHA] Anonymous sign-in failed:', err);
        if (!settled) {
          settled = true;
          rejectAuthReady(err);
          reject(err);
        }
        try { off(); } catch (_) {}
      });
    });
  }

  W.HHA_initFirebaseCompat = initFirebaseCompat;
  W.HHA_ensureAnonymousAuth = ensureAnonymousAuth;
  W.HHA_waitForFirebaseAuth = function () {
    return W.HHA_FIREBASE_AUTH_READY
      ? Promise.resolve({ uid: W.HHA_FIREBASE_UID })
      : W.HHA_FIREBASE_AUTH_READY_PROMISE.then((uid) => ({ uid }));
  };

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (initFirebaseCompat()) {
      clearInterval(timer);
      ensureAnonymousAuth().catch((err) => {
        console.error('[HHA] ensureAnonymousAuth failed:', err);
      });
    } else if (tries >= 120) {
      clearInterval(timer);
    }
  }, 100);
})();
