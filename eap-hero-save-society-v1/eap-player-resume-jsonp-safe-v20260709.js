/* EAP Hero JSONP compatibility shim — Single Authority Runtime owns callbacks. */
(function(){
  'use strict';
  if(window.__EAP_JSONP_GUARD_RETIRED_V5__) return;
  window.__EAP_JSONP_GUARD_RETIRED_V5__=true;
  window.EAPPlayerResumeJsonpSafe={
    version:'20260802-EAP-JSONP-GUARD-V5-RETIRED',
    protectCallback:function(){return true;},
    retry:function(){return false;},
    watched:Object.create(null)
  };
})();
