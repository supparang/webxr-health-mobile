/* =========================================================
   EAP Word Quest • Mobile Next Question Guard
   Version: 20260729-EAPWQ-MOBILE-NEXT-V284

   - Keeps the next-question action visible after feedback.
   - Enables next only after an answer has produced feedback.
   - Uses bounded, event-driven refreshes; no MutationObserver.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-EAPWQ-MOBILE-NEXT-V284';
  var bound = false;

  if (window.__EAP_WORD_MOBILE_NEXT_V284__) return;
  window.__EAP_WORD_MOBILE_NEXT_V284__ = true;

  function byId(id) {
    return document.getElementById(id);
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  }

  function feedbackIsVisible() {
    var feedback = byId('feedbackBox');
    if (!feedback) return false;
    return !feedback.hidden && feedback.offsetParent !== null;
  }

  function answerWasSelected() {
    var choices = byId('choicesEl');
    if (!choices) return false;
    return Boolean(
      choices.querySelector('.selected,.correct,.wrong,[aria-pressed="true"],button:disabled') ||
      feedbackIsVisible()
    );
  }

  function ensureNextVisible(scrollIntoView) {
    var next = byId('nextBtn');
    var actions = next && next.closest ? next.closest('.game-actions') : null;
    if (!next || !feedbackIsVisible() || !answerWasSelected()) return;

    next.hidden = false;
    next.style.display = 'inline-flex';
    next.style.visibility = 'visible';
    next.style.opacity = '1';
    next.style.pointerEvents = 'auto';
    next.disabled = false;
    next.removeAttribute('disabled');
    next.setAttribute('aria-disabled', 'false');
    next.textContent = next.textContent && next.textContent.trim() ? next.textContent : 'ข้อต่อไป';

    if (actions) {
      actions.classList.add('eap-mobile-next-ready');
      actions.style.display = 'flex';
      actions.style.visibility = 'visible';
    }

    if (scrollIntoView && isMobile()) {
      setTimeout(function () {
        try {
          next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (ignore) {
          window.scrollTo(0, document.body.scrollHeight);
        }
      }, 80);
    }
  }

  function boundedAfterAnswer() {
    [0, 80, 220, 500, 900].forEach(function (delay, index) {
      setTimeout(function () {
        ensureNextVisible(index === 2);
      }, delay);
    });
  }

  function injectStyle() {
    if (byId('eapWordMobileNextStyle284')) return;
    var style = document.createElement('style');
    style.id = 'eapWordMobileNextStyle284';
    style.textContent = [
      '@media(max-width:760px){',
      '#gameScreen .game-card{padding-bottom:96px!important}',
      '#gameScreen .game-actions.eap-mobile-next-ready{position:sticky;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:40;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:8px;padding:10px;background:rgba(255,255,255,.97);border:1px solid #dbe4ff;border-radius:16px;box-shadow:0 -8px 28px rgba(15,23,42,.14);backdrop-filter:blur(10px)}',
      '#gameScreen .game-actions.eap-mobile-next-ready #nextBtn{display:flex!important;align-items:center;justify-content:center;min-height:54px;width:100%;font-size:18px;font-weight:900}',
      '#gameScreen .game-actions.eap-mobile-next-ready #aiHelpBtn{min-height:54px;width:100%}',
      '}',
      '@media(min-width:761px){#nextBtn{scroll-margin-block:120px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function bind() {
    if (bound) return;
    bound = true;
    injectStyle();

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('#choicesEl button,#choicesEl [role="button"],#choicesEl .choice')) {
        boundedAfterAnswer();
      }
    }, true);

    document.addEventListener('keydown', function (event) {
      var target = event.target;
      if ((event.key === 'Enter' || event.key === ' ') && target && target.closest && target.closest('#choicesEl')) {
        boundedAfterAnswer();
      }
    }, true);

    window.addEventListener('resize', function () {
      setTimeout(function () { ensureNextVisible(false); }, 120);
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) setTimeout(function () { ensureNextVisible(false); }, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  window.inspectEapWordMobileNextV284 = function () {
    return {
      version: VERSION,
      mobile: isMobile(),
      feedbackVisible: feedbackIsVisible(),
      answerSelected: answerWasSelected(),
      nextDisabled: byId('nextBtn') ? byId('nextBtn').disabled : null
    };
  };

  console.info('[EAP Word Quest] mobile next-question guard ready', { version: VERSION });
})();
