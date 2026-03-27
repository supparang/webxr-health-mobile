/* /herohealth/firebase-config.js
   Firebase v8 compat config bootstrap
*/
(function(){
  'use strict';

  if (!window.firebase) {
    console.error('[firebase-config] firebase sdk missing');
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
      console.log('[firebase-config] reused existing app');
    }

    window.HHA_FIREBASE_READY = true;
    console.log('[firebase-config] ready =', !!(firebase.apps && firebase.apps.length));
  }catch(err){
    window.HHA_FIREBASE_READY = false;
    console.error('[firebase-config] init failed:', err);
  }
})();