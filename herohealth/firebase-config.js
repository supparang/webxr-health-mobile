<!-- === /herohealth/firebase-config.js ===
HeroHealth Firebase Config
FULL PATCH v20260322-FIREBASE-CONFIG-HHA-DB-READY
Requires Firebase compat scripts to be loaded before this file:
- https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js
- https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js
If not present, this file will try to inject them automatically.
-->
<script>
(function () {
  'use strict';

  const PATCH = 'v20260322-FIREBASE-CONFIG-HHA-DB-READY';

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
  const FIREBASE_APP_SRC = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js';
  const FIREBASE_DB_SRC  = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js';

  window.HHA_FIREBASE_CONFIG = firebaseConfig;
  window.__HHA_FIREBASE_CONFIG__ = firebaseConfig;
  window.firebaseConfig = firebaseConfig;

  window.HHA_FIREBASE_READY = false;
  window.HHA_FIREBASE_APP = null;
  window.HHA_FIREBASE_DB = null;
  window.__HHA_FIREBASE_PATCH__ = PATCH;

  function log(...args){
    try { console.log('[HHA firebase]', ...args); } catch (_) {}
  }

  function warn(...args){
    try { console.warn('[HHA firebase]', ...args); } catch (_) {}
  }

  function fail(...args){
    try { console.error('[HHA firebase]', ...args); } catch (_) {}
  }

  function markReady(app, db){
    window.HHA_FIREBASE_APP = app || null;
    window.HHA_FIREBASE_DB = db || null;
    window.HHA_FIREBASE_READY = !!db;

    try {
      window.dispatchEvent(new CustomEvent('hha:firebase-ready', {
        detail: {
          patch: PATCH,
          ready: !!db
        }
      }));
    } catch (_) {}

    log('ready =', !!db, 'patch =', PATCH);
  }

  function hasCompatFirebase(){
    return !!(window.firebase && typeof window.firebase.initializeApp === 'function');
  }

  function getExistingScript(src){
    return Array.from(document.scripts || []).find(s => {
      try { return (s.src || '').includes(src); } catch (_) { return false; }
    }) || null;
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const existing = getExistingScript(src);
      if (existing) {
        if (existing.dataset.loaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once:true });
        existing.addEventListener('error', (e) => reject(e), { once:true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.hhaFirebase = '1';
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  async function ensureCompatLoaded(){
    if (hasCompatFirebase()) return true;

    try {
      await loadScript(FIREBASE_APP_SRC);
      await loadScript(FIREBASE_DB_SRC);
    } catch (err) {
      fail('failed to load firebase compat scripts', err);
      return false;
    }

    return hasCompatFirebase();
  }

  function getOrInitApp(){
    const fb = window.firebase;
    if (!fb) throw new Error('firebase compat not available');

    let app = null;

    try {
      if (typeof fb.app === 'function') {
        try {
          app = fb.app(APP_NAME);
        } catch (_) {}
      }

      if (!app && Array.isArray(fb.apps)) {
        app = fb.apps.find(a => {
          try { return a && a.name === APP_NAME; } catch (_) { return false; }
        }) || null;
      }

      if (!app) {
        app = fb.initializeApp(firebaseConfig, APP_NAME);
      }

      return app;
    } catch (err) {
      throw new Error(`initialize app failed: ${err?.message || err}`);
    }
  }

  function getDbFromApp(app){
    const fb = window.firebase;
    if (!fb || !app) throw new Error('firebase app unavailable');

    try {
      if (typeof app.database === 'function') {
        return app.database();
      }
    } catch (_) {}

    try {
      if (typeof fb.database === 'function') {
        return fb.database(app);
      }
    } catch (_) {}

    throw new Error('database compat API unavailable');
  }

  async function initFirebase(){
    if (window.HHA_FIREBASE_DB && window.HHA_FIREBASE_READY) {
      return {
        app: window.HHA_FIREBASE_APP,
        db: window.HHA_FIREBASE_DB
      };
    }

    const ok = await ensureCompatLoaded();
    if (!ok) {
      throw new Error('firebase compat scripts not loaded');
    }

    const app = getOrInitApp();
    const db = getDbFromApp(app);

    markReady(app, db);
    return { app, db };
  }

  function exposeHelpers(){
    window.HHA_INIT_FIREBASE = async function(){
      return initFirebase();
    };

    window.HHA_WAIT_FIREBASE = async function(timeoutMs = 4000){
      const started = Date.now();

      while (Date.now() - started < timeoutMs) {
        if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;
        try {
          await initFirebase();
          if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;
        } catch (_) {}
        await new Promise(r => setTimeout(r, 80));
      }

      return window.HHA_FIREBASE_DB || null;
    };
  }

  exposeHelpers();

  initFirebase().catch(err => {
    window.HHA_FIREBASE_READY = false;
    window.HHA_FIREBASE_APP = null;
    window.HHA_FIREBASE_DB = null;
    fail('init failed', err);
  });
})();
</script>