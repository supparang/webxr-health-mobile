/* /herohealth/firebase-config.js
   FULL PATCH v20260330-FIREBASE-CONFIG-HYDR-DUET-ANON
   ใช้กับ:
   - /herohealth/hydration-lobby.html
   - /herohealth/hydration-vr/hydration-vr.html
   - anonymous auth + RTDB rules using auth.uid

   SCRIPT ORDER (สำคัญมาก)
   1) firebase-app-compat.js
   2) firebase-auth-compat.js
   3) firebase-database-compat.js
   4) firebase-config.js
*/
(function (W) {
  'use strict';

  if (!W.firebase) {
    console.error('[firebase-config] firebase sdk missing');
    W.HHA_FIREBASE_READY = false;
    return;
  }

  const firebase = W.firebase;

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

  function hasAuthSdk() {
    return typeof firebase.auth === 'function';
  }

  function hasDbSdk() {
    return typeof firebase.database === 'function';
  }

  let app = null;
  let db = null;
  let auth = null;

  try {
    app = (firebase.apps && firebase.apps.length)
      ? firebase.app()
      : firebase.initializeApp(config);

    if (!hasDbSdk()) {
      throw new Error('firebase-database-compat.js missing');
    }

    db = firebase.database(app);

    if (hasAuthSdk()) {
      auth = firebase.auth(app);
    } else {
      console.warn('[firebase-config] firebase-auth-compat.js missing');
    }

    W.HHA_FIREBASE_CONFIG = config;
    W.__firebaseConfig = config;
    W.__HHA_FIREBASE_CONFIG__ = config;

    W.HHA_FIREBASE_APP = app;
    W.HHA_DB = db;
    W.HHA_AUTH = auth || null;

    W.HHA_getFirebaseApp = function () {
      return W.HHA_FIREBASE_APP || null;
    };

    W.HHA_getFirebaseDb = function () {
      return W.HHA_DB || null;
    };

    W.HHA_getFirebaseAuth = function () {
      return W.HHA_AUTH || null;
    };

    W.HHA_ensureAnonymousAuth = async function () {
      if (!hasAuthSdk()) {
        throw new Error('firebase-auth-compat.js missing');
      }

      const authInstance = W.HHA_AUTH || firebase.auth(app);

      if (authInstance.currentUser && authInstance.currentUser.uid) {
        return authInstance.currentUser;
      }

      const cred = await authInstance.signInAnonymously();
      const user = (cred && cred.user) || authInstance.currentUser || null;

      if (!user || !user.uid) {
        throw new Error('Anonymous auth did not return a valid user');
      }

      W.HHA_AUTH = authInstance;
      return user;
    };

    W.HHA_FIREBASE_READY = !!(app && db);

    console.log('[firebase-config] initializeApp ok');
    console.log('[firebase-config] auth sdk =', hasAuthSdk());
    console.log('[firebase-config] database sdk =', hasDbSdk());
    console.log('[firebase-config] ready =', W.HHA_FIREBASE_READY);

  } catch (err) {
    W.HHA_FIREBASE_READY = false;
    console.error('[firebase-config] init failed:', err);
  }
})(window);