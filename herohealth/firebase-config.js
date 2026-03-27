// /herohealth/firebase/firebase-config.js
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

  function fail(msg, err) {
    console.error('[HHA firebase-config]', msg, err || '');
    window.HHA_FIREBASE_ERROR = msg + (err ? (' :: ' + (err.message || err)) : '');
  }

  if (!window.firebase) {
    fail('Firebase SDK ยังไม่ถูกโหลด — ต้องใส่ firebase-app-compat.js ก่อน firebase-config.js');
    return;
  }

  try {
    const app = (firebase.apps && firebase.apps.length)
      ? firebase.app()
      : firebase.initializeApp(firebaseConfig);

    window.HHA_FIREBASE_CONFIG = firebaseConfig;
    window.HHA_FIREBASE_APP = app;
    window.HHA_FIREBASE_READY = Promise.resolve(app);

    console.log('[HHA firebase-config] ready:', firebaseConfig.projectId);
  } catch (err) {
    fail('initializeApp ไม่สำเร็จ', err);
    window.HHA_FIREBASE_READY = Promise.reject(err);
  }
})();