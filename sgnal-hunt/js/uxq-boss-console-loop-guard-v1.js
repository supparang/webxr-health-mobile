/* UX Quest • Mission Integrity Preloader v1.9
 * Loads case-specific hardening, replay banks, anti-guess, result-integrity
 * and teacher-only preview layers before the mission engine starts.
 */
(() => {
  'use strict';
  const path = String(location.pathname || '').toLowerCase();
  const query = new URLSearchParams(location.search || '');
  const route = /(w2-design-thinking-sprint|w3-cognitive-load-escape|b1-cognitive-storm|w4-user-insight-lab|w5-concept-forge|w6-flow-rescue|b2-flow-fortress)\.html/.test(path);
  const boss = /(b1-cognitive-storm|b2-flow-fortress)\.html/.test(path);
  const w2 = /w2-design-thinking-sprint\.html/.test(path);
  const qa = w2 && ['1', 'true', 'yes'].includes(String(query.get('qa') || '').toLowerCase());
  const preview = qa && ['1', 'true', 'yes'].includes(String(query.get('preview') || '').toLowerCase());
  if (route && document.readyState === 'loading') {
    const w2Hardening = w2 ? '<script data-uxq-w2-sprint-preprocessor src="./js/uxq-w2-sprint-preprocessor-v1.js?v=20260706-w2-native-antiguess-v1"></' + 'script>' : '';
    const replay = boss ? '<script data-uxq-boss-replay-bank src="./js/uxq-boss-replay-bank-v1.js?v=20260706-boss-replay-v2"></' + 'script>' : '';
    const antiGuess = '<script data-uxq-w2b2-antiguess src="./js/uxq-w2-b2-antiguess-v1.js?v=20260706-antiguess-v1"></' + 'script>';
    const teacherPreview = preview ? '<script data-uxq-w2-teacher-preview src="./js/uxq-w2-teacher-preview-v1.js?v=20260706-w2-preview-v2"></' + 'script>' : '';
    const integrity = '<script data-uxq-result-integrity src="./js/uxq-result-integrity-v1.js?v=20260706-result-integrity-v1"></' + 'script>';
    const qaLab = qa ? '<script data-uxq-w2-qa src="./js/uxq-w2-qa-lab-v1.js?v=20260706-w2-qa-v3"></' + 'script>' : '';
    document.write(w2Hardening + replay + antiGuess + teacherPreview + integrity + qaLab);
  }
})();
