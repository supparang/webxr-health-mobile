(function () {
  "use strict";

  // Public runtime configuration only.
  // NEVER place DATABASE_URL, database passwords, signing secrets,
  // research salts, tokens, or other credentials in this file.
  window.ACTIVA_CONFIG = Object.freeze({
    releaseVersion: "ACTIVA-AI-1.0.15",
    // Public OAuth audience, verified against the backend before Google Sign-In.
    googleClientId: "517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com",
    apiBaseUrl: "",
    deploymentMode: "DUAL_DEMO_AND_PILOT_API"
  });
})();
