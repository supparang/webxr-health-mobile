window.HH_CONFIG = window.HH_CONFIG || {};

window.HH_CONFIG.backend = {
  enabled: true,
  webAppUrl: "https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec",
  queueOffline: true,
  duplicateGuard: true,
  syncIntervalMs: 15000,
  transportPolicy: "full-payload-single-submit",
  gameShellVersion: "20260731-GAME-SHELL-AUTO-RETURN-R41-BALANCE-V50-HANDWASH-SCHEMA-R49",
  balanceAnalyticsVersion: "20260731-BALANCE-ANALYTICS-V50-DIRECT-FINISH",
  handwashSchemaCompatibilityVersion: "20260731-GAME-SHELL-HANDWASH-SCHEMA-V2-R49",
  loginRouteGuardVersion: "20260731-PROFILE-CONFIRM-ROUTE-GUARD-R42"
};

window.HH_CONFIG.teacherAccess = {
  sessionKey: "herohealth_teacher_authorized_v1",
  pin: "7319"
};

const hhRuntimePath = String(location.pathname || '');

// Keep the newly verified student identity in the URL before the authority login reload.
// This prevents a stale sid/studentId from the previous learner from resetting the new profile.
if (/\/HeroHealth_Learning1\/(?:index\.html)?$/i.test(hhRuntimePath)) {
  const loginGuard = document.createElement('script');
  loginGuard.src = './assets/profile-confirm-route-guard-r42.js?v=20260731-r42-stale-student-route';
  loginGuard.async = false;
  loginGuard.dataset.hhPatch = 'profile-confirm-route-guard-r42';
  document.head.appendChild(loginGuard);

  // Install after the Passport runtime becomes available. This overrides any cached older
  // launcher and forces Balance Hold through the V50 direct-finish analytics wrapper.
  const launcherHotfix = document.createElement('script');
  launcherHotfix.src = './assets/game-shell-launcher-v50-hotfix.js?v=20260731-v50-direct-finish';
  launcherHotfix.async = false;
  launcherHotfix.dataset.hhPatch = 'game-shell-launcher-v50-hotfix';
  document.head.appendChild(launcherHotfix);
}

// Load transport compatibility before the classroom shell submits a Handwash payload.
// The current Sheet receiver validates HH-UNIFIED-GAME-ANALYTICS-V2 for Handwash.
if (/game-shell-authority-r40\.html$/i.test(hhRuntimePath)) {
  const handwashSchema = document.createElement('script');
  handwashSchema.src = './assets/game-shell-handwash-schema-v2-r49.js?v=20260731-r49-v2-contract';
  handwashSchema.async = false;
  handwashSchema.dataset.hhPatch = 'game-shell-handwash-schema-v2-r49';
  document.head.appendChild(handwashSchema);

  // Load the authority-confirmed auto-return repair only inside the classroom game shell.
  // The repair verifies the current attempt from Student Authority when HH_Events receipt
  // is delayed, then returns the learner to Hero Passport automatically.
  const script = document.createElement('script');
  script.src = './assets/game-shell-auto-return-r41.js?v=20260731-r41-current-authority-receipt';
  script.async = false;
  script.dataset.hhPatch = 'game-shell-auto-return-r41';
  document.head.appendChild(script);
}
