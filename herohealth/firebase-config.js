/* /herohealth/firebase-config.js
   FULL PATCH v20260327-FIREBASE-CONFIG-DUET-READY
*/
(function (W) {
  'use strict';

  if (!W.firebase) {
    console.error('[firebase-config] firebase sdk not found');
    return;
  }

  const firebaseConfig = {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID'
  };

  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('[firebase-config] initialized');
    } else {
      firebase.app();
      console.log('[firebase-config] reuse existing app');
    }
  } catch (err) {
    console.error('[firebase-config] init failed:', err);
  }

  try {
    W.HHA_FIREBASE_APP = firebase.app();
    W.HHA_DB = firebase.database();
  } catch (err) {
    console.error('[firebase-config] database bind failed:', err);
  }

  /* optional cloud logger endpoint */
  W.HHA_CLOUD_ENDPOINT =
    W.HHA_CLOUD_ENDPOINT ||
    'https://script.google.com/macros/s/AKfycbwNOpsjFTV_nK0PzNV23KziF5hZxIMI50P8o_vZgwVg_T4anpXZOaKQUy_uf5PPg9kT6Q/exec';

})(window);
