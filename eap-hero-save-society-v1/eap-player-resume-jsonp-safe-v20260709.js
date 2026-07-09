/* =========================================================
   EAP Hero Player Resume JSONP Safe Retry v20260709
   V1
   - Handles late Apps Script JSONP responses after the original callback
     timed out and was already cleaned up by eap-player-resume-v1.js.
   - Prevents the visible console flow from breaking on errors like:
     __eapCloudResume_xxx is not defined.
   - Retries EAPPlayerResume.sync silently so the learner keeps moving.
   - UI/retry only. Does not change Sheet rows, scores, pass/fail, evidence,
     teacher review, or unlock logic.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260709-EAP-PLAYER-RESUME-JSONP-SAFE-RETRY-V1';
  var lastRetryAt = 0;

  function retrySoon(){
    var now = Date.now();
    if (now - lastRetryAt < 4500) return;
    lastRetryAt = now;
    setTimeout(function(){
      try {
        if (window.EAPPlayerResume && typeof window.EAPPlayerResume.sync === 'function') {
          window.EAPPlayerResume.sync({ silent:true, reason:'jsonp_late_callback_retry' });
        }
      } catch(_) {}
    }, 650);
  }

  function isLateResumeCallbackError(message, filename){
    message = String(message || '');
    filename = String(filename || '');
    return /__eapCloudResume_[A-Za-z0-9_]+\s+is\s+not\s+defined/i.test(message) ||
      (/__eapCloudResume_/i.test(message) && /player_resume|script\.google\.com|macros\/s\//i.test(filename));
  }

  window.addEventListener('error', function(event){
    var msg = event && (event.message || (event.error && event.error.message));
    var file = event && event.filename;
    if (!isLateResumeCallbackError(msg, file)) return;
    try { event.preventDefault(); } catch(_) {}
    retrySoon();
    return true;
  }, true);

  window.EAPPlayerResumeJsonpSafe = {
    version: VERSION,
    retry: retrySoon
  };
})();