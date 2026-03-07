// === /herohealth/firebase-config.js ===
(function () {
  'use strict';

  if (!window.firebase) {
    console.error('[firebase-config] firebase compat SDK not loaded');
    window.HHA_FIREBASE_READY = false;
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55"
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
