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
    apiKey: 'AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo',
    authDomain: 'herohealth-d7f8c.firebaseapp.com',
    databaseURL: 'https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'herohealth-d7f8c',
    storageBucket: 'herohealth-d7f8c.firebasestorage.app',
    messagingSenderId: '680817376848',
    appId: '1:680817376848:web:eed21b522b0703f6bd9b55'
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
