// /herohealth/firebase-config.js
// FULL PATCH v20260327-GJBATTLE-FIREBASE-CONFIG-R1
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

      if (W.HHA_FIREBASE_READY) {
        try {
          W.dispatchEvent(new CustomEvent('hha:firebase-ready', {
            detail: { app: W.HHA_FIREBASE_APP }
          }));
        } catch (_) {}
      }

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

  W.HHA_initFirebaseCompat = initFirebaseCompat;

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const ok = initFirebaseCompat();
    if (ok || tries >= 120) clearInterval(timer);
  }, 100);
})();