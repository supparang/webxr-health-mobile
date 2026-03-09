// === /herohealth/firebase-config.js ===
(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55"
  };

  // ให้ battle-rtdb.js อ่าน config ได้แน่ ๆ
  window.HHA_FIREBASE_CONFIG = firebaseConfig;
  window.__HHA_FIREBASE_CONFIG__ = firebaseConfig;
  window.firebaseConfig = firebaseConfig;

  // compat branch (ถ้ามี firebase compat SDK อยู่แล้ว)
  if (window.firebase) {
    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      window.HHA_FIREBASE_APP = firebase.app();
      window.HHA_FIREBASE_DB = firebase.database();
      window.HHA_FIREBASE_READY = true;

      console.log('[firebase-config] Firebase compat ready');
      return;
    } catch (err) {
      console.error('[firebase-config] compat init failed:', err);
      window.HHA_FIREBASE_READY = false;
      return;
    }
  }

  // modular users ยังใช้ config object ได้ แม้ไม่มี compat SDK
  window.HHA_FIREBASE_READY = true;
  console.log('[firebase-config] Firebase config exposed (modular/RTDB loader can use it)');
})();