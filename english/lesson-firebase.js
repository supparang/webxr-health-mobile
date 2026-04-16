import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let _app = null;
let _auth = null;
let _db = null;
let _runtime = null;

function resolveConfig() {
  const injected = window.__firebase_config
    ? JSON.parse(window.__firebase_config)
    : null;

  const staticConfig = window.TECHPATH_FIREBASE_CONFIG || null;

  const firebaseConfig = injected || staticConfig;

  if (!firebaseConfig) {
    throw new Error("Missing Firebase config");
  }

  if (!firebaseConfig.databaseURL) {
    throw new Error("Missing Realtime Database URL");
  }

  return firebaseConfig;
}

export function initFirebaseRuntime() {
  if (_runtime) return _runtime;

  const firebaseConfig = resolveConfig();
  const appId =
    window.TECHPATH_APP_ID ||
    window.__app_id ||
    firebaseConfig.projectId ||
    "english-d4bfa";

  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db = getDatabase(_app);

  _runtime = {
    app: _app,
    auth: _auth,
    db: _db,
    appId
  };

  signInAnonymously(_auth).catch((err) => {
    console.error("Anonymous sign-in failed:", err);
  });

  return _runtime;
}

export {
  onAuthStateChanged,
  ref,
  get,
  set,
  onValue
};
