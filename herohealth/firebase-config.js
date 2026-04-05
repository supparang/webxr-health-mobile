(function (W) {
  'use strict';

  const CONFIG = {
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

  try {
    console.log('[firebase-config] loaded', CONFIG.projectId);
  } catch (_) {}
})(window);
