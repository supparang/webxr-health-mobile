/* UX Quest • Boss Console Guard v1.4
 * Loads the W2–B2 anti-guess layer synchronously before the mission engine.
 */
(() => {
  'use strict';
  const route = /(w2-design-thinking-sprint|w3-cognitive-load-escape|b1-cognitive-storm|w4-user-insight-lab|w5-concept-forge|w6-flow-rescue|b2-flow-fortress)\.html/i.test(location.pathname);
  if (route && document.readyState === 'loading') {
    document.write('<script data-uxq-w2b2-antiguess src="./js/uxq-w2-b2-antiguess-v1.js?v=20260706-antiguess-v1"></' + 'script>');
  }
})();
