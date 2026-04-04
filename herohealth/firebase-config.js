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

  window.HHA_FIREBASE_READY = false;
  window.HHA_FIREBASE_ERROR = '';

  if (!window.firebase) {
    window.HHA_FIREBASE_ERROR = 'Firebase SDK not loaded';
    console.error('[HHA] Firebase SDK not loaded');
    return;
  }

  try {
    const app = firebase.apps && firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(cfg);

    const db = firebase.database(app);
    const auth = firebase.auth(app);

    window.HHA_FIREBASE_APP = app;
    window.HHA_FIREBASE_DB = db;
    window.HHA_FIREBASE_AUTH = auth;

    auth.onAuthStateChanged(async (user) => {
      try {
        if (!user) {
          await auth.signInAnonymously();
          return;
        }
        window.HHA_FIREBASE_USER = user;
        window.HHA_FIREBASE_UID = user.uid;
        window.HHA_FIREBASE_READY = true;
        console.log('[HHA] Firebase ready:', user.uid);
      } catch (err) {
        window.HHA_FIREBASE_ERROR = err?.message || String(err);
        console.error('[HHA] auth ready failed', err);
      }
    });
  } catch (err) {
    window.HHA_FIREBASE_ERROR = err?.message || String(err);
    console.error('[HHA] Firebase init failed', err);
  }
})();