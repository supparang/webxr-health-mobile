// === /herohealth/firebase-config.js ===
// FULL PATCH v20260327-FIREBASE-CONFIG-AUTOLOAD-COMPAT-INIT

(function () {
  'use strict';

  const PATCH = 'v20260327-FIREBASE-CONFIG-AUTOLOAD-COMPAT-INIT';

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

  window.HHA_FIREBASE_CONFIG = firebaseConfig;
  window.HHA_FIREBASE_READY = false;
  window.HHA_FIREBASE_APP = null;
  window.HHA_FIREBASE_DB = null;
  window.__HHA_FIREBASE_PATCH__ = PATCH;

  function log(...args){
    try { console.log('[firebase-config]', ...args); } catch(_) {}
  }

  function warn(...args){
    try { console.warn('[firebase-config]', ...args); } catch(_) {}
  }

  function fail(...args){
    try { console.error('[firebase-config]', ...args); } catch(_) {}
  }

  function findScript(src){
    return Array.from(document.scripts || []).find(s => {
      try { return (s.src || '').includes(src); } catch(_) { return false; }
    }) || null;
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const existing = findScript(src);
      if (existing) {
        if (existing.dataset.loaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once:true });
        existing.addEventListener('error', reject, { once:true });
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

  async function ensureCompatLoaded(){
    if (window.firebase && typeof window.firebase.initializeApp === 'function') {
      return true;
    }

    await loadScript(APP_SRC);
    await loadScript(DB_SRC);

    return !!(window.firebase && typeof window.firebase.initializeApp === 'function');
  }

  async function initFirebase(){
    if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;

    const ok = await ensureCompatLoaded();
    if (!ok) throw new Error('firebase compat sdk not available');

    const fb = window.firebase;
    let app = null;

    try { app = fb.app(APP_NAME); } catch(_) {}
    if (!app) app = fb.initializeApp(firebaseConfig, APP_NAME);

    const db = app.database();

    window.HHA_FIREBASE_APP = app;
    window.HHA_FIREBASE_DB = db;
    window.HHA_FIREBASE_READY = true;

    try {
      window.dispatchEvent(new CustomEvent('hha:firebase-ready', {
        detail: { patch: PATCH, ready: true }
      }));
    } catch(_) {}

    log('initialized', PATCH);
    return db;
  }

  window.HHA_INIT_FIREBASE = initFirebase;

  window.HHA_WAIT_FIREBASE = async function(timeoutMs = 4000){
    const started = Date.now();

    while(Date.now() - started < timeoutMs){
      if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;

      try {
        const db = await initFirebase();
        if (db) return db;
      } catch(_) {}

      await new Promise(r => setTimeout(r, 80));
    }

    return window.HHA_FIREBASE_DB || null;
  };

  initFirebase().catch(err => {
    fail('init failed', err);
    window.HHA_FIREBASE_READY = false;
    window.HHA_FIREBASE_APP = null;
    window.HHA_FIREBASE_DB = null;
  });
})();