/* /herohealth/firebase-config.js
   Firebase v8 compat bootstrap
*/
(function(){
  'use strict';

  if (!window.firebase) {
    console.error('[firebase-config] firebase sdk missing');
    window.HHA_FIREBASE_READY = false;
    return;
  }

  const firebase = window.firebase;

  const config = {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID'
  };

  try{
    if (!firebase.apps || !firebase.apps.length){
      firebase.initializeApp(config);
      console.log('[firebase-config] initializeApp ok');
    }else{
      console.log('[firebase-config] reuse existing app');
    }

    window.HHA_FIREBASE_READY = !!(firebase.apps && firebase.apps.length);
    console.log('[firebase-config] ready =', window.HHA_FIREBASE_READY);
  }catch(err){
    window.HHA_FIREBASE_READY = false;
    console.error('[firebase-config] init failed:', err);
  }
})();