/* /herohealth/firebase-config.js
   Firebase compat bootstrap - FINAL MATCHED
   For HeroHealth pages using window.firebase + anonymous auth
*/
(function () {
  'use strict';

  const W = window;

  // ถ้ามี context พร้อมอยู่แล้ว ไม่ต้อง init ซ้ำ
  if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
    if (!W.HHA_FIREBASE_READY) {
      W.HHA_FIREBASE_READY = Promise.resolve(W.HHA_FIREBASE);
    }
    return;
  }

  // ===== HeroHealth Firebase Config =====
  // ใช้ค่าที่คุณเคยแปะมาให้ก่อน
  // ถ้า Realtime Database URL ของโปรเจกต์จริงไม่ตรง ให้แก้เฉพาะ databaseURL บรรทัดเดียว
  const CONFIG = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    projectId: "herohealth-d7f8c",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app"
  };

  W.HHA_FIREBASE_CONFIG = CONFIG;
  W.HEROHEALTH_FIREBASE_CONFIG = CONFIG;
  W.FIREBASE_CONFIG = CONFIG;
  W.__firebaseConfig = CONFIG;

  function makeCtx(app, auth, db) {
    return {
      app,
      auth,
      db,
      config: CONFIG,
      ready: !!(app && auth && db)
    };
  }

  async function initFirebaseCompat() {
    if (!W.firebase) {
      throw new Error('Firebase compat SDK not loaded');
    }

    const fb = W.firebase;

    let app;
    try {
      app = (fb.apps && fb.apps.length)
        ? fb.app()
        : fb.initializeApp(CONFIG);
    } catch (err) {
      if (fb.apps && fb.apps.length) {
        app = fb.app();
      } else {
        throw err;
      }
    }

    const auth = (fb.auth && typeof fb.auth === 'function')
      ? fb.auth()
      : null;

    const db = (fb.database && typeof fb.database === 'function')
      ? fb.database()
      : null;

    if (!auth) throw new Error('Firebase Auth compat not available');
    if (!db) throw new Error('Firebase Realtime Database compat not available');

    try {
      if (!auth.currentUser && typeof auth.signInAnonymously === 'function') {
        await auth.signInAnonymously();
      }
    } catch (err) {
      console.warn('[HeroHealth Firebase] signInAnonymously failed:', err && err.message ? err.message : err);
    }

    const ctx = makeCtx(app, auth, db);
    W.HHA_FIREBASE = ctx;
    return ctx;
  }

  W.HHA_FIREBASE_READY = (async () => {
    // ถ้ามีแล้วให้คืนทันที
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
      return W.HHA_FIREBASE;
    }

    // ลอง init ได้เลย
    try {
      return await initFirebaseCompat();
    } catch (firstErr) {
      // เผื่อ SDK ยังโหลดไม่ทัน ให้รอสั้น ๆ แล้วลองอีกครั้ง
      const start = Date.now();
      const timeoutMs = 10000;

      while ((Date.now() - start) < timeoutMs) {
        await new Promise((r) => setTimeout(r, 120));

        if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
          return W.HHA_FIREBASE;
        }

        if (W.firebase) {
          try {
            return await initFirebaseCompat();
          } catch (_) {}
        }
      }

      throw firstErr;
    }
  })();

})();