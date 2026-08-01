/* =========================================================
   EAP Word Quest • Review Replay Guard
   Version: 20260801-EAPWQ-V304-REVIEW-REPLAY-GUARD

   Loaded before V301 so a Review replay starts exactly one new
   Weak Words review attempt instead of incrementing twice.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260801-EAPWQ-V304-REVIEW-REPLAY-GUARD';
  if (window.__EAP_WORD_V304_REVIEW_REPLAY_GUARD__) return;
  window.__EAP_WORD_V304_REVIEW_REPLAY_GUARD__ = true;

  function reviewActive() {
    var value = null;
    try {
      if (typeof window.getEapWordReviewContextV301 === 'function') {
        value = window.getEapWordReviewContextV301();
      }
    } catch (ignore) {}
    return Boolean(value && value.active);
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('#replayBtn') : null;
    var weak;
    if (!button || !reviewActive()) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.__EAP_WORD_REVIEW_REPLAY_PENDING__ = true;
    weak = document.getElementById('weakStartBtn');
    if (weak) weak.click();
    setTimeout(function () { window.__EAP_WORD_REVIEW_REPLAY_PENDING__ = false; }, 0);
  }, true);

  console.info('[EAP Word Quest] V304 review replay guard ready', { version:VERSION });
})();