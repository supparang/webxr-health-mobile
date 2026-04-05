(function (W) {
  'use strict';

  function pickConfig() {
    return (
      W.HHA_FIREBASE_CONFIG ||
      W.HEROHEALTH_FIREBASE_CONFIG ||
      W.FIREBASE_CONFIG ||
      W.__firebaseConfig ||
      null
    );
  }

  async function initFirebase() {
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
      return W.HHA_FIREBASE;
    }

    if (!W.firebase) {
      throw new Error('Firebase SDK not loaded');
    }

    const cfg = pickConfig();
    if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.databaseURL) {
      throw new Error('Missing Firebase config');
    }

    let app;
    try {
      app = (firebase.apps && firebase.apps.length)
        ? firebase.app()
        : firebase.initializeApp(cfg);
    } catch (err) {
      if (firebase.apps && firebase.apps.length) {
        app = firebase.app();
      } else {
        throw err;
      }
    }

    const auth = (firebase.auth && typeof firebase.auth === 'function')
      ? firebase.auth()
      : null;

    const db = (firebase.database && typeof firebase.database === 'function')
      ? firebase.database()
      : null;

    if (!db) {
      throw new Error('Realtime Database SDK not available');
    }

    const ctx = {
      app,
      auth,
      db,
      config: cfg,
      ready: true
    };

    W.HHA_FIREBASE = ctx;

    if (auth && !auth.currentUser && typeof auth.signInAnonymously === 'function') {
      try {
        await auth.signInAnonymously();
        console.log('[firebase-init] anonymous auth ready');
      } catch (err) {
        console.warn('[firebase-init] anonymous auth skipped/failed:', err?.message || err);
      }
    }

    try {
      W.dispatchEvent(new CustomEvent('hha:firebase-ready', { detail: ctx }));
    } catch (_) {}

    console.log('[firebase-init] ready', cfg.projectId);
    return ctx;
  }

  W.HHA_FIREBASE_READY = initFirebase().catch((err) => {
    console.error('[firebase-init] failed:', err);
    throw err;
  });
})(window);
