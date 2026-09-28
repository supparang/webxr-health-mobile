(function () {
  "use strict";

  // Public runtime configuration only.
  // NEVER place DATABASE_URL, database passwords, signing secrets,
  // research salts, tokens, or other credentials in this file.
  window.ACTIVA_CONFIG = Object.freeze({
    releaseVersion: "ACTIVA-AI-1.0.15",
    apiBaseUrl: "",
    deploymentMode: "DUAL_DEMO_AND_PILOT_API"
  });
})();
