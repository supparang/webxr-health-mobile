/* =========================================================
   EAP Hero Player Resume JSONP Safe Retry v20260709
   V2 KEEP LATE CALLBACKS DEFINED
   - Handles late Apps Script JSONP responses after the original callback
     timed out and eap-player-resume-v1.js tried to clean it up.
   - Prevents errors like: __eapCloudResume_xxx is not defined.
   - Intercepts player_resume JSONP script injection and keeps a safe noop
     callback installed even after cleanup. The original callback still runs
     normally when the response arrives on time.
   - Retries EAPPlayerResume.sync silently so the learner keeps moving.
   - UI/retry only. Does not change Sheet rows, scores, pass/fail, evidence,
     teacher review, or unlock logic.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260709-EAP-PLAYER-RESUME-JSONP-SAFE-RETRY-V2-KEEP-CALLBACK';
  var PREFIX = '__eapCloudResume_';
  var lastRetryAt = 0;
  var watched = {};
  var nativeHeadAppend = null;
  var nativeBodyAppend = null;

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

  function noopCallback(){
    retrySoon();
  }

  function callbackNameFromScript(node){
    try {
      if (!node || String(node.tagName || '').toLowerCase() !== 'script') return '';
      var src = String(node.src || node.getAttribute('src') || '');
      if (!/action=player_resume/i.test(src) || src.indexOf(PREFIX) < 0) return '';
      var url = new URL(src, location.href);
      var cb = String(url.searchParams.get('callback') || '');
      return cb.indexOf(PREFIX) === 0 ? cb : '';
    } catch(_) {
      return '';
    }
  }

  function protectCallback(cb){
    if (!cb || watched[cb]) return;
    watched[cb] = true;

    var handler = typeof window[cb] === 'function' ? window[cb] : null;
    var safe = function(data){
      if (handler && handler !== safe) {
        try { return handler(data); }
        catch(error) { setTimeout(function(){ throw error; }, 0); }
      }
      return noopCallback(data);
    };

    try {
      Object.defineProperty(window, cb, {
        configurable: false,
        enumerable: false,
        get: function(){ return handler || safe; },
        set: function(fn){ handler = (typeof fn === 'function') ? fn : safe; }
      });
    } catch(_) {
      /* If another script already locked it, keep the normal error guard below. */
    }

    /* If the Apps Script response is very late, the safe callback remains present.
       This avoids ReferenceError while the real resume sync retries quietly. */
    setTimeout(function(){
      if (typeof window[cb] !== 'function') {
        try { window[cb] = safe; } catch(_) {}
      }
    }, 1000);
  }

  function patchAppend(target, prop){
    if (!target || !target.appendChild || target.appendChild.__eapJsonpSafePatched) return target && target.appendChild;
    var nativeAppend = target.appendChild;
    var patched = function(node){
      var cb = callbackNameFromScript(node);
      if (cb) protectCallback(cb);
      return nativeAppend.call(this, node);
    };
    patched.__eapJsonpSafePatched = true;
    target.appendChild = patched;
    return nativeAppend;
  }

  function isLateResumeCallbackError(message, filename){
    message = String(message || '');
    filename = String(filename || '');
    return /__eapCloudResume_[A-Za-z0-9_]+\s+is\s+not\s+defined/i.test(message) ||
      (/__eapCloudResume_/i.test(message) && /player_resume|script\.google\.com|macros\/s\//i.test(filename));
  }

  function boot(){
    nativeHeadAppend = patchAppend(document.head, 'head');
    nativeBodyAppend = patchAppend(document.body, 'body');

    window.addEventListener('error', function(event){
      var msg = event && (event.message || (event.error && event.error.message));
      var file = event && event.filename;
      if (!isLateResumeCallbackError(msg, file)) return;
      try { event.preventDefault(); } catch(_) {}
      retrySoon();
      return true;
    }, true);
  }

  boot();

  window.EAPPlayerResumeJsonpSafe = {
    version: VERSION,
    retry: retrySoon,
    protectCallback: protectCallback,
    watched: watched
  };
})();