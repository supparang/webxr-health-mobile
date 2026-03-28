/* /herohealth/firebase-config.js
   Firebase compat bootstrap - REAL CONFIG
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
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55",
    measurementId: "G-T5J8DC0BKD"
  };

  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(config);
      console.log('[firebase-config] initializeApp ok');
    } else {
      console.log('[firebase-config] reuse existing app');
    }

    window.HHA_FIREBASE_CONFIG = config;
    window.__HHA_FIREBASE_CONFIG__ = config;
    window.HHA_FIREBASE_READY = !!(firebase.apps && firebase.apps.length);

    if (!window.HHA_ensureAnonymousAuth) {
      window.HHA_ensureAnonymousAuth = async function(){
        try {
          if (!firebase.auth().currentUser) {
            await firebase.auth().signInAnonymously();
          }
          return firebase.auth().currentUser || null;
        } catch (err) {
          console.error('[firebase-config] anonymous auth failed:', err);
          throw err;
        }
      };
    }

    console.log('[firebase-config] ready =', window.HHA_FIREBASE_READY);
  } catch (err) {
    window.HHA_FIREBASE_READY = false;
    console.error('[firebase-config] init failed:', err);
  }
})();