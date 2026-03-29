(function () {
  'use strict';

  const W = window;

  if (W.__HHA_FIREBASE_CONFIG_LOADED__) {
    return;
  }
  W.__HHA_FIREBASE_CONFIG_LOADED__ = true;

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

  function log(...args) {
    console.log('[HHA Firebase]', ...args);
  }

  function fail(message, extra) {
    const err = extra instanceof Error ? extra : new Error(String(message || 'Firebase error'));
    W.HHA_FIREBASE_ERROR = err.message || String(message || 'Firebase error');
    console.error('[HHA Firebase]', message, extra || '');
    return err;
  }

  function sdkReady() {
    return !!(W.firebase && firebase.initializeApp && firebase.auth && firebase.database);
  }

  function getAuth() {
    if (!sdkReady()) throw fail('Firebase SDK ยังไม่ถูกโหลดครบ');
    return firebase.auth();
  }

  function getDb() {
    if (!sdkReady()) throw fail('Firebase Database SDK ยังไม่ถูกโหลด');
    return firebase.database();
  }

  function getApp() {
    if (!sdkReady()) throw fail('Firebase SDK ยังไม่พร้อมสำหรับ initialize');
    try {
      if (firebase.apps && firebase.apps.length) {
        return firebase.app();
      }
      return firebase.initializeApp(CONFIG);
    } catch (err) {
      if (String(err && err.message || '').includes('already exists')) {
        return firebase.app();
      }
      throw fail('initializeApp ไม่สำเร็จ', err);
    }
  }

  function ensureApp() {
    const app = getApp();
    W.HHA_FIREBASE_APP = app;
    W.HHA_FIREBASE_DB = getDb();
    W.HHA_FIREBASE_AUTH = getAuth();
    return app;
  }

  function authStateOnce(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let off = null;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { if (typeof off === 'function') off(); } catch {}
        reject(fail('รอสถานะ auth นานเกินไป'));
      }, timeoutMs);

      try {
        off = getAuth().onAuthStateChanged(
          (user) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { if (typeof off === 'function') off(); } catch {}
            resolve(user || null);
          },
          (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { if (typeof off === 'function') off(); } catch {}
            reject(fail('onAuthStateChanged error', err));
          }
        );
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(fail('ผูก onAuthStateChanged ไม่สำเร็จ', err));
      }
    });
  }

  async function signInAnonSafe() {
    ensureApp();

    const auth = getAuth();
    if (auth.currentUser) return auth.currentUser;

    try {
      const cred = await auth.signInAnonymously();
      return cred && cred.user ? cred.user : auth.currentUser;
    } catch (err) {
      throw fail('Anonymous auth ไม่สำเร็จ', err);
    }
  }

  async function ensureAnonymousAuth() {
    ensureApp();

    const auth = getAuth();
    if (auth.currentUser) {
      W.HHA_CURRENT_UID = auth.currentUser.uid;
      return auth.currentUser;
    }

    if (!W.__HHA_AUTH_PROMISE__) {
      W.__HHA_AUTH_PROMISE__ = (async () => {
        const user = await signInAnonSafe();
        const confirmed = user || await authStateOnce(10000);
        if (!confirmed) {
          throw fail('ล็อกอิน anonymous แล้วแต่ยังไม่ได้ currentUser');
        }
        W.HHA_CURRENT_UID = confirmed.uid;
        return confirmed;
      })().finally(() => {
        W.__HHA_AUTH_PROMISE__ = null;
      });
    }

    return W.__HHA_AUTH_PROMISE__;
  }

  async function ensureFirebaseReady() {
    ensureApp();
    const user = await ensureAnonymousAuth();
    return {
      app: W.HHA_FIREBASE_APP,
      db: W.HHA_FIREBASE_DB,
      auth: W.HHA_FIREBASE_AUTH,
      user
    };
  }

  function getCurrentUid() {
    try {
      const auth = getAuth();
      return auth.currentUser ? String(auth.currentUser.uid || '') : '';
    } catch {
      return '';
    }
  }

  function getCurrentUser() {
    try {
      return getAuth().currentUser || null;
    } catch {
      return null;
    }
  }

  function makeDevicePid() {
    try {
      const KEY = 'HHA_DEVICE_PID';
      let pid = localStorage.getItem(KEY);
      if (!pid) {
        pid = 'p-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(KEY, pid);
      }
      return String(pid || '').replace(/[.#$[\]/]/g, '-').trim();
    } catch {
      return 'p-' + Math.random().toString(36).slice(2, 10);
    }
  }

  function dbRef(path) {
    ensureApp();
    if (!path) throw fail('dbRef ต้องระบุ path');
    return getDb().ref(String(path));
  }

  function dbServerTime() {
    ensureApp();
    return firebase.database.ServerValue.TIMESTAMP;
  }

  function onValue(ref, handler, errorHandler) {
    if (!ref || typeof ref.on !== 'function') {
      throw fail('onValue ต้องใช้กับ firebase ref');
    }
    const ok = typeof handler === 'function' ? handler : function () {};
    const bad = typeof errorHandler === 'function'
      ? errorHandler
      : function (err) { console.error('[HHA Firebase] onValue error', err); };

    ref.on('value', ok, bad);
    return function off() {
      try { ref.off('value', ok); } catch {}
    };
  }

  function onChildAdded(ref, handler, errorHandler) {
    if (!ref || typeof ref.on !== 'function') {
      throw fail('onChildAdded ต้องใช้กับ firebase ref');
    }
    const ok = typeof handler === 'function' ? handler : function () {};
    const bad = typeof errorHandler === 'function'
      ? errorHandler
      : function (err) { console.error('[HHA Firebase] onChildAdded error', err); };

    ref.on('child_added', ok, bad);
    return function off() {
      try { ref.off('child_added', ok); } catch {}
    };
  }

  function onChildChanged(ref, handler, errorHandler) {
    if (!ref || typeof ref.on !== 'function') {
      throw fail('onChildChanged ต้องใช้กับ firebase ref');
    }
    const ok = typeof handler === 'function' ? handler : function () {};
    const bad = typeof errorHandler === 'function'
      ? errorHandler
      : function (err) { console.error('[HHA Firebase] onChildChanged error', err); };

    ref.on('child_changed', ok, bad);
    return function off() {
      try { ref.off('child_changed', ok); } catch {}
    };
  }

  function onChildRemoved(ref, handler, errorHandler) {
    if (!ref || typeof ref.on !== 'function') {
      throw fail('onChildRemoved ต้องใช้กับ firebase ref');
    }
    const ok = typeof handler === 'function' ? handler : function () {};
    const bad = typeof errorHandler === 'function'
      ? errorHandler
      : function (err) { console.error('[HHA Firebase] onChildRemoved error', err); };

    ref.on('child_removed', ok, bad);
    return function off() {
      try { ref.off('child_removed', ok); } catch {}
    };
  }

  async function pingFirebase() {
    const ready = await ensureFirebaseReady();
    const uid = ready.user && ready.user.uid ? ready.user.uid : '';
    log('ready', { uid });
    return { ok: true, uid };
  }

  W.HHA_getFirebaseApp = function () {
    ensureApp();
    return W.HHA_FIREBASE_APP;
  };

  W.HHA_getFirebaseDb = function () {
    ensureApp();
    return W.HHA_FIREBASE_DB;
  };

  W.HHA_getFirebaseAuth = function () {
    ensureApp();
    return W.HHA_FIREBASE_AUTH;
  };

  W.HHA_ensureFirebaseReady = ensureFirebaseReady;
  W.HHA_ensureAnonymousAuth = ensureAnonymousAuth;
  W.HHA_getCurrentUid = getCurrentUid;
  W.HHA_getCurrentUser = getCurrentUser;
  W.HHA_makeDevicePid = makeDevicePid;
  W.HHA_dbRef = dbRef;
  W.HHA_dbServerTime = dbServerTime;
  W.HHA_onValue = onValue;
  W.HHA_onChildAdded = onChildAdded;
  W.HHA_onChildChanged = onChildChanged;
  W.HHA_onChildRemoved = onChildRemoved;
  W.HHA_pingFirebase = pingFirebase;

  try {
    ensureApp();
    log('initialized');
  } catch (err) {
    fail('init bootstrap ไม่สำเร็จ', err);
  }
})();