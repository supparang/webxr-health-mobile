/* CSAI2102 AI Quest — S2 AR Result Bridge v4.0.8 compatibility shim
   Older cached Student Pages may request this filename. Delegate directly to
   the canonical v406 singleton so no legacy sender can create duplicates.
*/
(() => {
  'use strict';

  const CURRENT_VERSION = 'v4.0.7-s2-ar-singleton-dedup-sync';
  const CURRENT_SRC = './js/aiquest-s2-ar-result-bridge-v406.js?v=20260629-s2bridge408';

  if (window.AIQUEST_S2_AR_RESULT_BRIDGE?.version === CURRENT_VERSION) return;

  const absolute = new URL(CURRENT_SRC, document.baseURI).href;
  if ([...document.scripts].some((script) => script.src === absolute)) return;

  const script = document.createElement('script');
  script.src = CURRENT_SRC;
  script.async = false;
  script.dataset.aiquestS2CanonicalBridge = 'v408';
  script.onerror = () => console.warn('[AIQuest S2 AR] canonical result bridge failed to load');
  document.head.appendChild(script);
})();
