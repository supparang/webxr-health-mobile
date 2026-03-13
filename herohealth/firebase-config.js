// === /herohealth/firebase-config.js ===
// HeroHealth Firebase Config
// FULL PATCH v20260313-FIREBASE-CONFIG-COMPAT-AUTOLOAD-r2
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

  window.HHA_FIREBASE_CONFIG = firebaseConfig;
  window.__HHA_FIREBASE_CONFIG__ = firebaseConfig;
  window.firebaseConfig = firebaseConfig;

  window.HHA_FIREBASE_READY = false;

  function fireReady(ok, extra = {}) {
    window.HHA_FIREBASE_READY = !!ok;
    try {
      window.dispatchEvent(new CustomEvent('hha:firebase_ready', {
        detail: { ok: !!ok, ...extra }
      }));
    } catch (_) {}
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(s => s.src === src);
      if (existing) {
        if (existing.dataset.loaded === '1') {
          resolve(src);
          return;
        }
        existing.addEventListener('load', () => resolve(src), { once: true });
        existing.addEventListener('error', () => reject(new Error('load fail: ' + src)), { once: true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve(src);
      };
      s.onerror = () => reject(new Error('load fail: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureCompatSdk() {
    if (window.firebase && typeof window.firebase.initializeApp === 'function') {
      return window.firebase;
    }

    await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');

    if (!window.firebase || typeof window.firebase.initializeApp !== 'function') {
      throw new Error('firebase compat sdk unavailable');
    }

    return window.firebase;
  }

  async function boot() {
    try {
      const firebase = await ensureCompatSdk();

      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      const app = firebase.app();
      const db = firebase.database();

      window.HHA_FIREBASE_APP = app;
      window.HHA_FIREBASE_DB = db;
      window.HHA_FIREBASE = firebase;

      console.log('[firebase-config] Firebase compat ready');
      fireReady(true, { appName: app?.name || '[DEFAULT]' });
    } catch (err) {
      console.error('[firebase-config] init failed:', err);
      window.HHA_FIREBASE_APP = null;
      window.HHA_FIREBASE_DB = null;
      fireReady(false, { error: String(err?.message || err) });
    }
  }

  boot();
})();