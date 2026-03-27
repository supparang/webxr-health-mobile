/* /herohealth/firebase-config.js
   FULL PATCH v20260327-FIREBASE-CONFIG-DUET-READY-R3
*/
(function (W) {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo',
    authDomain: 'herohealth-d7f8c.firebaseapp.com',
    databaseURL: 'https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'herohealth-d7f8c',
    storageBucket: 'herohealth-d7f8c.firebasestorage.app',
    messagingSenderId: '680817376848',
    appId: '1:680817376848:web:eed21b522b0703f6bd9b55'
  };

  /* สำคัญมาก: ให้ไฟล์ run ทุกโหมดอ่าน config จากตัวนี้ได้ */
  W.HHA_FIREBASE_CONFIG = firebaseConfig;

  /* optional cloud logger endpoint */
  W.HHA_CLOUD_ENDPOINT =
    W.HHA_CLOUD_ENDPOINT ||
    'https://script.google.com/macros/s/AKfycbwNOpsjFTV_nK0PzNV23KziF5hZxIMI50P8o_vZgwVg_T4anpXZOaKQUy_uf5PPg9kT6Q/exec';

  if (!W.firebase) {
    W.HHA_FIREBASE_READY = false;
    console.error('[firebase-config] firebase sdk not found');
    return;
  }

  try {
    const app = (W.firebase.apps && W.firebase.apps.length)
      ? W.firebase.app()
      : W.firebase.initializeApp(firebaseConfig);

    W.HHA_FIREBASE_APP = app;
    W.HHA_DB = W.firebase.database ? W.firebase.database() : null;
    W.HHA_AUTH = W.firebase.auth ? W.firebase.auth() : null;
    W.HHA_FIREBASE_READY = !!(W.HHA_DB && firebaseConfig.databaseURL);

    console.log('[firebase-config] ready =', W.HHA_FIREBASE_READY);
  } catch (err) {
    W.HHA_FIREBASE_READY = false;
    console.error('[firebase-config] init failed:', err);
  }
})(window);
