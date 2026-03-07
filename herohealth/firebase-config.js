// === /herohealth/firebase-config.js ===
// Firebase COMPAT bootstrap for HeroHealth
// ใช้คู่กับ:
// - firebase-app-compat.js
// - firebase-database-compat.js
// - firebase-auth-compat.js (ถ้ามี)

(function () {
  'use strict';

  if (!window.firebase) {
    console.error('[firebase-config] firebase compat SDK not loaded');
    window.HHA_FIREBASE_READY = false;
    return;
  }

  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    window.HHA_FIREBASE_APP = firebase.app();
    window.HHA_FIREBASE_DB = firebase.database();
    window.HHA_FIREBASE_READY = true;

    console.log('[firebase-config] Firebase compat ready');
  } catch (err) {
    console.error('[firebase-config] init failed:', err);
    window.HHA_FIREBASE_READY = false;
  }
})();
