/* Legacy S2 bootstrap compatibility shim.
   The current S2 player loads its own optional decorators. Old URLs must not block Start.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_LEGACY_BOOTSTRAP_SAFE_V674__)return;
  window.__AIQUEST_S2_LEGACY_BOOTSTRAP_SAFE_V674__=true;
  window.AIQuestS2DecoratorsReady=Promise.resolve(true);
})();
