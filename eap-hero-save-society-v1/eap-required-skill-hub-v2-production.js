/* =========================================================
   EAP Required Skill Hub v2 → v122 compatibility loader
   The former full replacement hub was not reliably activated by every
   rendered Session layout. v122 annotates the live four-skill controls
   directly, preserving the current mission UI and all Sheet authority.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_REQUIRED_SKILL_V122_LOADER__)return;
  window.__EAP_REQUIRED_SKILL_V122_LOADER__=true;
  var script=document.createElement('script');
  script.async=false;
  script.src='./eap-required-skill-labels-v122.js?v=20260802-required-skill-labels-v122';
  script.dataset.eapRequiredSkillLoader='v122';
  document.head.appendChild(script);
})();
