/* =========================================================
   EAP Required Skill Hub compatibility shim v126

   The production page now loads eap-required-skill-labels-v122.js directly.
   This former loader must remain inert so an older cached labels script is
   not injected a second time and does not compete through MutationObserver.
========================================================= */
(function(){
  'use strict';
  window.__EAP_REQUIRED_SKILL_HUB_COMPAT_V126__ = true;
})();
