// /english/js/lesson-firebase.js
'use strict';

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

export { ref, get, set, onValue, onAuthStateChanged };

export function resolveFirebaseRuntime() {
  const injectedConfig =
    (typeof __firebase_config !== "undefined" && __firebase_config)
      ? JSON.parse(__firebase_config)
      : null;

  const staticConfig =
    window.TECHPATH_FIREBASE_CONFIG ||
    window.FIREBASE_CONFIG ||
    null;

  const firebaseConfig = injectedConfig || staticConfig;

  const appId =
    (typeof __app_id !== "undefined" && __app_id) ||
    window.TECHPATH_APP_ID ||
    "english-d4bfa";

  return { firebaseConfig, appId };
}

export async function initFirebaseRuntime() {
  const { firebaseConfig, appId } = resolveFirebaseRuntime();

  if (!firebaseConfig || !firebaseConfig.databaseURL) {
    return {
      db: null,
      auth: null,
      appId,
      missingConfig: true
    };
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  try {
    if (!auth.currentUser) {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    }
  } catch (e) {
    console.error("Firebase auth init error:", e);
  }

  return {
    db,
    auth,
    appId,
    missingConfig: false
  };
}
