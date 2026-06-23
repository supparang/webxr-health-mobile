// === /sgnal-hunt/js/uxq-w1-unlock-v3.js ===
// W1 completion-page safety net. It repairs progress even when the learner completed W1 before the bridge existed.

(function () {
  'use strict';

  function numberFromText(value) {
    const match = String(value || '').replace(/,/g, '').match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function syncFromCompletionDom() {
    const card = document.querySelector('.complete-card');
    const bridge = window.UXQProgressBridge;

    if (!card || !bridge || typeof bridge.markW1Complete !== 'function') {
      return;
    }

    const earnedStars = card.querySelectorAll('.final-star.earned').length;
    const text = card.textContent || '';
    const scoreMatch = text.match(/Final\s*Score\s*(\d+)/i);
    const score = scoreMatch ? Number(scoreMatch[1]) : numberFromText(text);

    if (earnedStars >= 1 || score >= 200) {
      bridge.markW1Complete({
        stars: Math.max(1, earnedStars),
        score,
        rounds: 1,
        source: 'w1-completion-dom-v3'
      });
    }
  }

  const observer = new MutationObserver(syncFromCompletionDom);

  window.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    syncFromCompletionDom();
    window.setTimeout(syncFromCompletionDom, 350);
    window.setTimeout(syncFromCompletionDom, 1200);
  });
})();
