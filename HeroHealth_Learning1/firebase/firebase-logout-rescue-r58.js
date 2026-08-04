(() => {
  'use strict';

  const mode = String(new URLSearchParams(location.search).get('authority') || '').toLowerCase();
  if (mode !== 'firebase' && mode !== 'dual') return;

  // Compatibility shim only.
  // Login, progress hydration, and logout are owned exclusively by
  // firebase/passport-index-integration.js R63+.
  // Keeping this file prevents stale index.html caches from returning 404,
  // while avoiding duplicate event handlers and legacy R59 imports.
  window.HH_FIREBASE_LEGACY_LOGOUT_RESCUE_DISABLED = true;
  console.info('[HeroHealth Firebase] legacy logout rescue R58 retired; unified integration owns session flow');
})();
