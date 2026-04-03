/* /herohealth/firebase-config.js
   Firebase compat bootstrap - hydration/duet/coop safe
*/
(function(){
  'use strict';

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

  // export config เสมอ แม้ SDK ยังไม่โหลด
  window.HHA_FIREBASE_CONFIG = config;
  window.__HHA_FIREBASE_CONFIG__ = config;
  window.HEROHEALTH_FIREBASE_CONFIG = config;
  window.FIREBASE_CONFIG = config;
  window.HHA_FIREBASE_READY = false;

  function ensureHelpers(firebase){
    window.HHA_getFirebaseApp = function(){
      return (firebase.apps && firebase.apps.length) ? firebase.app() : null;
    };

    window.HHA_ensureAnonymousAuth = async function(){
      const auth = firebase.auth();
      if (!auth.currentUser) {
        await auth.signInAnonymously();
      }
      return auth.currentUser || null;
    };
  }

  function bootstrap(){
    if (!window.firebase) {
      window.HHA_FIREBASE_READY = false;
      console.warn('[firebase-config] Firebase SDK not ready yet; config exported');
      return null;
    }

    const firebase = window.firebase;

    try {
      const app = (firebase.apps && firebase.apps.length)
        ? firebase.app()
        : firebase.initializeApp(config);

      ensureHelpers(firebase);
      window.HHA_FIREBASE_READY = true;
      console.log('[firebase-config] ready = true');
      return app;
    } catch (err) {
      if (firebase.apps && firebase.apps.length) {
        ensureHelpers(firebase);
        window.HHA_FIREBASE_READY = true;
        return firebase.app();
      }
      window.HHA_FIREBASE_READY = false;
      console.error('[firebase-config] init failed:', err);
      return null;
    }
  }

  window.HHA_bootstrapFirebaseCompat = bootstrap;

  // ลอง init ทันที ถ้า SDK มาแล้ว
  bootstrap();
})();