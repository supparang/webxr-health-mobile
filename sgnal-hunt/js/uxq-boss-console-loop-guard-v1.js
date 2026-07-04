/* UX Quest • Mission Integrity Preloader v1.6
 * Loads replay-bank, anti-guess and result-integrity layers before the mission engine.
 */
(() => {
  'use strict';
  const path = String(location.pathname || '').toLowerCase();
  const route = /(w2-design-thinking-sprint|w3-cognitive-load-escape|b1-cognitive-storm|w4-user-insight-lab|w5-concept-forge|w6-flow-rescue|b2-flow-fortress)\.html/.test(path);
  const boss = /(b1-cognitive-storm|b2-flow-fortress)\.html/.test(path);
  if (route && document.readyState === 'loading') {
    const replay = boss ? '<script data-uxq-boss-replay-bank src="./js/uxq-boss-replay-bank-v1.js?v=20260706-boss-replay-v2"></' + 'script>' : '';
    const antiGuess = '<script data-uxq-w2b2-antiguess src="./js/uxq-w2-b2-antiguess-v1.js?v=20260706-antiguess-v1"></' + 'script>';
    const integrity = '<script data-uxq-result-integrity src="./js/uxq-result-integrity-v1.js?v=20260706-result-integrity-v1"></' + 'script>';
    document.write(replay + antiGuess + integrity);
  }
})();
