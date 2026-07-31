window.HH_CONFIG = window.HH_CONFIG || {};

window.HH_CONFIG.backend = {
  enabled: true,
  webAppUrl: "https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec",
  queueOffline: true,
  duplicateGuard: true,
  syncIntervalMs: 15000,
  transportPolicy: "full-payload-single-submit",
  gameShellVersion: "20260731-GAME-SHELL-AUTO-RETURN-R41"
};

window.HH_CONFIG.teacherAccess = {
  sessionKey: "herohealth_teacher_authorized_v1",
  pin: "7319"
};

// Load the authority-confirmed auto-return repair only inside the classroom game shell.
// The repair verifies the current attempt from Student Authority when HH_Events receipt
// is delayed, then returns the learner to Hero Passport automatically.
if (/game-shell-authority-r40\.html$/i.test(String(location.pathname || ''))) {
  const script = document.createElement('script');
  script.src = './assets/game-shell-auto-return-r41.js?v=20260731-r41-current-authority-receipt';
  script.async = false;
  script.dataset.hhPatch = 'game-shell-auto-return-r41';
  document.head.appendChild(script);
}
