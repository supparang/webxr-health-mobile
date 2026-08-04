(() => {
  'use strict';

  // Compatibility shim only.
  // Session login, Firebase hydrate, and logout are owned exclusively by
  // firebase/passport-index-integration.js. This file remains only because
  // older cached index.html versions may still request it.
  window.__HH_FIREBASE_LEGACY_SESSION_BRIDGE_DISABLED__ = true;
  console.info('[HeroHealth Firebase] duplicate legacy session bridge disabled');
})();
