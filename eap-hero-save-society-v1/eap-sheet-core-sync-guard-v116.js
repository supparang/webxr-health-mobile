/* Preserve sheet endpoint for the dedicated bridge, then disable the legacy sender inside eap-hero.js. */
(function () {
  'use strict';
  const cfg = window.EAP_SHEET_CONFIG || {};
  window.EAP_SHEET_BRIDGE_CONFIG = {
    enabled: !!cfg.enabled,
    webAppUrl: String(cfg.webAppUrl || ''),
    section: String(cfg.section || '122'),
    course: String(cfg.course || 'EAP Hero: Save the Society')
  };
  window.EAP_SHEET_CONFIG = Object.assign({}, cfg, { enabled: false });
})();
