/* =========================================================
   EAP Hero Player Resume JSONP Guard v20260723
   V3 ABSORB LATE CALLBACKS — NO AUTO RETRY LOOP

   Purpose:
   - Keep late Apps Script JSONP callbacks defined.
   - Prevent __eapCloudResume_xxx is not defined errors.
   - Never trigger a new resume request from a late callback.
   - The official EAPPlayerResume module alone owns retry timing.
   - UI guard only; does not derive or change official progress.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260723-EAP-PLAYER-RESUME-JSONP-GUARD-V3-NO-RETRY-STORM';
  var PREFIX = '__eapCloudResume_';
  var watched = Object.create(null);

  function noopCallback(){
    return undefined;
  }

  function callbackNameFromScript(node){
    try {
      if (!node || String(node.tagName || '').toLowerCase() !== 'script') return '';
      var src = String(node.src || node.getAttribute('src') || '');
      if (!/action=player_resume/i.test(src) || src.indexOf(PREFIX) < 0) return '';
      var url = new URL(src, location.href);
      var cb = String(url.searchParams.get('callback') || '');
      return cb.indexOf(PREFIX) === 0 ? cb : '';
    } catch (_) {
      return '';
    }
  }

  function protectCallback(cb){
    if (!cb || watched[cb]) return;
    watched[cb] = true;

    var handler = typeof window[cb] === 'function' ? window[cb] : null;
    var safe = function(data){
      if (handler && handler !== safe) {
        try {
          return handler(data);
        } catch (error) {
          setTimeout(function(){ throw error; }, 0);
        }
      }
      return noopCallback(data);
    };

    try {
      Object.defineProperty(window, cb, {
        configurable: false,
        enumerable: false,
        get: function(){ return handler || safe; },
        set: function(fn){ handler = typeof fn === 'function' ? fn : safe; }
      });
    } catch (_) {
      try {
        if (typeof window[cb] !== 'function') window[cb] = safe;
      } catch (ignore) {}
    }

    setTimeout(function(){
      try {
        if (typeof window[cb] !== 'function') window[cb] = safe;
      } catch (ignore) {}
    }, 1000);
  }

  function patchAppend(target){
    if (!target || !target.appendChild || target.appendChild.__eapJsonpGuardPatched) return;
    var nativeAppend = target.appendChild;
    var patched = function(node){
      var cb = callbackNameFromScript(node);
      if (cb) protectCallback(cb);
      return nativeAppend.call(this, node);
    };
    patched.__eapJsonpGuardPatched = true;
    target.appendChild = patched;
  }

  function isLateResumeCallbackError(message, filename){
    message = String(message || '');
    filename = String(filename || '');
    return /__eapCloudResume_[A-Za-z0-9_]+\s+is\s+not\s+defined/i.test(message) ||
      (/__eapCloudResume_/i.test(message) && /player_resume|script\.google\.com|macros\/s\//i.test(filename));
  }

  function boot(){
    patchAppend(document.head);
    patchAppend(document.body);

    window.addEventListener('error', function(event){
      var msg = event && (event.message || (event.error && event.error.message));
      var file = event && event.filename;
      if (!isLateResumeCallbackError(msg, file)) return;
      try { event.preventDefault(); } catch (_) {}
      return true;
    }, true);
  }

  boot();

  window.EAPPlayerResumeJsonpSafe = {
    version: VERSION,
    protectCallback: protectCallback,
    watched: watched,
    retry: function(){
      return false;
    }
  };
})();