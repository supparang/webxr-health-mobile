// === /herohealth/vr-groups/groups-race-firebase-boot-v44.js ===
// HeroHealth • Groups Race Firebase Boot Guard
// PATCH v20260519-GROUPS-RACE-FIREBASE-BOOT-V44
//
// Fix:
// - Waiting Room ค้าง "กำลังเชื่อมต่อ Firebase..."
// - groups-race-run.js เริ่มก่อน firebase-config.js พร้อม
// - dispatch hha:firebase-ready ให้ run/lifecycle/rematch patch ใช้ร่วมกัน
// - anonymous auth guard

(function () {
  'use strict';

  const VERSION = 'v20260519-groups-race-firebase-boot-v44';

  if (window.__HHA_GROUPS_RACE_FIREBASE_BOOT_V44__) return;
  window.__HHA_GROUPS_RACE_FIREBASE_BOOT_V44__ = true;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const found = Array.from(document.scripts).some((s) => {
        const v = s.getAttribute('src') || '';
        return v.includes(src);
      });

      if (found) {
        resolve();
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Cannot load ' + src));
      document.head.appendChild(s);
    });
  }

  function emitReady(payload) {
    try {
      window.dispatchEvent(new CustomEvent('hha:firebase-ready', {
        detail: payload || window.HHA_FIREBASE || {}
      }));
    } catch (_) {}
  }

  function emitError(err) {
    try {
      window.dispatchEvent(new CustomEvent('hha:firebase-error', {
        detail: {
          message: err && err.message ? err.message : String(err),
          version: VERSION
        }
      }));
    } catch (_) {}
  }

  async function waitForHhaFirebase(timeoutMs = 7000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (window.HHA_FIREBASE && window.HHA_FIREBASE.ready && window.HHA_FIREBASE.db) {
        return window.HHA_FIREBASE;
      }

      if (window.firebase && window.firebase.apps && window.firebase.apps.length && window.firebase.database) {
        return {
          ready: true,
          auth: window.firebase.auth ? window.firebase.auth() : null,
          db: window.firebase.database()
        };
      }

      await new Promise((r) => setTimeout(r, 120));
    }

    throw new Error('Firebase did not become ready in time');
  }

  async function ensureAuth(fb) {
    const auth =
      fb.auth ||
      (window.firebase && window.firebase.auth ? window.firebase.auth() : null);

    if (!auth) {
      return {
        ...fb,
        auth: null,
        uid: ''
      };
    }

    try {
      if (!auth.currentUser && typeof auth.signInAnonymously === 'function') {
        await auth.signInAnonymously();
      }
    } catch (err) {
      console.warn('[Groups Race Firebase Boot v44] Anonymous sign-in failed', err);
    }

    return {
      ...fb,
      auth,
      uid: auth.currentUser && auth.currentUser.uid ? auth.currentUser.uid : ''
    };
  }

  async function boot() {
    try {
      console.info('[Groups Race Firebase Boot] starting', VERSION);

      if (!(window.firebase && window.firebase.apps)) {
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
      }

      /*
        path จาก /herohealth/vr-groups/ ไป /herohealth/firebase-config.js
      */
      if (!(window.HHA_FIREBASE && window.HHA_FIREBASE.ready)) {
        await loadScript('../firebase-config.js?v=20260519-race-firebase-boot-v44');
      }

      let fb = await waitForHhaFirebase();
      fb = await ensureAuth(fb);

      window.HHA_FIREBASE = {
        ...(window.HHA_FIREBASE || {}),
        ...fb,
        ready: true,
        bootVersion: VERSION,
        bootAt: Date.now()
      };

      emitReady(window.HHA_FIREBASE);

      console.info('[Groups Race Firebase Boot] ready', {
        version: VERSION,
        uid: window.HHA_FIREBASE.uid || '',
        hasDb: Boolean(window.HHA_FIREBASE.db)
      });
    } catch (err) {
      console.error('[Groups Race Firebase Boot] failed', err);

      window.HHA_FIREBASE = {
        ...(window.HHA_FIREBASE || {}),
        ready: false,
        error: err && err.message ? err.message : String(err),
        bootVersion: VERSION
      };

      emitError(err);
    }
  }

  window.HHA_GROUPS_RACE_FIREBASE_BOOT = {
    version: VERSION,
    boot
  };

  boot();
})();
