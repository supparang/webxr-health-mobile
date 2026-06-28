/* =========================================================
   EAP Word Quest • Logger Marker Guard
   File: /herohealth/eap-word-quest/eap-word-engine-v197-logger-guard.js
   Version: v1.9.7-LOGGER-MARKER-GUARD-122

   Fixes recurring logger bridge re-wraps caused when the storage-compaction
   wrapper replaced a marked logger with an unmarked function.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v1.9.7-LOGGER-MARKER-GUARD-122";
  const MARKERS = [
    "__eapV190Wrapped",
    "__eapV195Wrapped",
    "__eapV193Wrapped",
    "__eapV194Wrapped"
  ];

  if (window.__EAP_WORD_V197_LOGGER_GUARD__) return;
  window.__EAP_WORD_V197_LOGGER_GUARD__ = true;

  function mark(fn) {
    if (typeof fn !== "function") return fn;
    MARKERS.forEach(name => { fn[name] = true; });
    fn.__eapV197LoggerGuard = true;
    return fn;
  }

  try {
    let current = mark(window.logEapWordQuestResult);

    Object.defineProperty(window, "logEapWordQuestResult", {
      configurable: true,
      enumerable: true,
      get() {
        return current;
      },
      set(next) {
        current = mark(next);
      }
    });

    console.info("[EAP Word Quest] v197 logger marker guard ready", { version: VERSION });
  } catch (err) {
    mark(window.logEapWordQuestResult);
    console.warn("[EAP Word Quest] v197 logger guard fallback", err);
  }

  window.inspectEapV197LoggerGuard = () => {
    const logger = window.logEapWordQuestResult;
    return {
      version: VERSION,
      active: Boolean(window.__EAP_WORD_V197_LOGGER_GUARD__),
      loggerReady: typeof logger === "function",
      aiWrapBlocked: Boolean(logger && logger.__eapV190Wrapped),
      scoreWrapBlocked: Boolean(logger && logger.__eapV195Wrapped),
      markerGuarded: Boolean(logger && logger.__eapV197LoggerGuard)
    };
  };
})();
