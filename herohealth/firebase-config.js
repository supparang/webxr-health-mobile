// /herohealth/firebase-config.js
(function () {
  'use strict';

  const cfg = window.HHA_FIREBASE_CONFIG || {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55",
    measurementId: "G-T5J8DC0BKD"
  };

  const W = window;

  W.HHA_FIREBASE_READY = false;
  W.HHA_FIREBASE_ERROR = '';
  W.HHA_FIREBASE_STATUS = 'booting';
  W.HHA_FIREBASE_APP = null;
  W.HHA_FIREBASE_DB = null;
  W.HHA_FIREBASE_AUTH = null;
  W.HHA_FIREBASE_USER = null;
  W.HHA_FIREBASE_UID = '';
  W.HHA_FIREBASE_INIT_AT = Date.now();

  let signInStarted = false;
  let settled = false;

  function setError(err) {
    const msg = err && err.message ? err.message : String(err || 'Unknown Firebase error');
    W.HHA_FIREBASE_ERROR = msg;
    W.HHA_FIREBASE_STATUS = 'error';
    console.error('[HHA] Firebase error:', err);
    try {
      W.dispatchEvent(new CustomEvent('hha:firebase-error', {
        detail: { message: msg, error: err || null }
      }));
    } catch (_) {}
  }

  function setReady(user) {
    W.HHA_FIREBASE_USER = user || null;
    W.HHA_FIREBASE_UID = user && user.uid ? user.uid : '';
    W.HHA_FIREBASE_READY = true;
    W.HHA_FIREBASE_ERROR = '';
    W.HHA_FIREBASE_STATUS = 'ready';
    console.log('[HHA] Firebase ready:', W.HHA_FIREBASE_UID);
    try {
      W.dispatchEvent(new CustomEvent('hha:firebase-ready', {
        detail: {
          uid: W.HHA_FIREBASE_UID,
          user: W.HHA_FIREBASE_USER,
          db: W.HHA_FIREBASE_DB,
          auth: W.HHA_FIREBASE_AUTH,
          app: W.HHA_FIREBASE_APP
        }
      }));
    } catch (_) {}
  }

  W.HHA_FIREBASE_READY_PROMISE = new Promise((resolve, reject) => {
    if (!W.firebase) {
      const err = new Error('Firebase SDK not loaded');
      setError(err);
      reject(err);
      return;
    }

    try {
      const app = firebase.apps && firebase.apps.length
        ? firebase.app()
        : firebase.initializeApp(cfg);

      const db = firebase.database(app);
      const auth = firebase.auth(app);

      W.HHA_FIREBASE_APP = app;
      W.HHA_FIREBASE_DB = db;
      W.HHA_FIREBASE_AUTH = auth;
      W.HHA_FIREBASE_STATUS = 'initializing';

      auth.onAuthStateChanged(async (user) => {
        if (settled && user) return;

        try {
          if (!user) {
            if (signInStarted) return;
            signInStarted = true;
            W.HHA_FIREBASE_STATUS = 'signing-in';
            await auth.signInAnonymously();
            return;
          }

          settled = true;
          setReady(user);
          resolve({
            app: W.HHA_FIREBASE_APP,
            db: W.HHA_FIREBASE_DB,
            auth: W.HHA_FIREBASE_AUTH,
            user: W.HHA_FIREBASE_USER,
            uid: W.HHA_FIREBASE_UID
          });
        } catch (err) {
          if (settled) return;
          settled = true;
          setError(err);
          reject(err);
        }
      }, (err) => {
        if (settled) return;
        settled = true;
        setError(err);
        reject(err);
      });

    } catch (err) {
      if (settled) return;
      settled = true;
      setError(err);
      reject(err);
    }
  });
})();