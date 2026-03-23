// === /herohealth/firebase-config.js ===
// HeroHealth Firebase Config
// FULL PATCH v20260323-FIREBASE-CONFIG-MIN-SAFE

(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
    authDomain: "herohealth-d7f8c.firebaseapp.com",
    databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herohealth-d7f8c",
    storageBucket: "herohealth-d7f8c.firebasestorage.app",
    messagingSenderId: "680817376848",
    appId: "1:680817376848:web:eed21b522b0703f6bd9b55"
  };

  const APP_NAME = 'herohealth-main';
  const APP_SRC = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js';
  const DB_SRC  = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js';

  window.HHA_FIREBASE_READY = false;
  window.HHA_FIREBASE_APP = null;
  window.HHA_FIREBASE_DB = null;
  window.HHA_FIREBASE_CONFIG = firebaseConfig;

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const found = Array.from(document.scripts).find(s => (s.src || '').includes(src));
      if (found) {
        if (found.dataset.loaded === '1') return resolve();
        found.addEventListener('load', () => resolve(), { once:true });
        found.addEventListener('error', reject, { once:true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebaseCompat(){
    if (window.firebase && typeof window.firebase.initializeApp === 'function') return;

    await loadScript(APP_SRC);
    await loadScript(DB_SRC);
  }

  async function initFirebase(){
    if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;

    await ensureFirebaseCompat();

    const fb = window.firebase;
    if (!fb) throw new Error('firebase compat missing');

    let app = null;
    try { app = fb.app(APP_NAME); } catch (_) {}
    if (!app) app = fb.initializeApp(firebaseConfig, APP_NAME);

    const db = app.database();

    window.HHA_FIREBASE_APP = app;
    window.HHA_FIREBASE_DB = db;
    window.HHA_FIREBASE_READY = true;

    return db;
  }

  window.HHA_INIT_FIREBASE = initFirebase;

  window.HHA_WAIT_FIREBASE = async function(timeoutMs = 4000){
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;
      try {
        const db = await initFirebase();
        if (db) return db;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 80));
    }
    return window.HHA_FIREBASE_DB || null;
  };

  initFirebase().catch(err => {
    console.error('[firebase-config] init failed:', err);
    window.HHA_FIREBASE_READY = false;
    window.HHA_FIREBASE_APP = null;
    window.HHA_FIREBASE_DB = null;
  });
})();