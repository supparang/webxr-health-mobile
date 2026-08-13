/* =========================================================
   EAP Hero • Boss Auto Finalize v1
   VERSION: 20260813-BOSS-AUTO-FINALIZE-V1

   PURPOSE
   - When a Boss adaptive run visibly reaches Run Complete
     with Reading + Listening + Writing + Speaking complete,
     finalize the Boss immediately through the canonical
     no-loop finisher instead of exposing the legacy
     Enter Boss Clash -> Guardian loop.
   - Does not invent cloud progress. The existing no-loop
     finisher emits the normal boss-defeated event so the
     existing completion sync remains authoritative.
========================================================= */
(function () {
  'use strict';
  if (window.__EAP_BOSS_AUTO_FINALIZE_V1__) return;
  window.__EAP_BOSS_AUTO_FINALIZE_V1__ = true;

  var VERSION = '20260813-BOSS-AUTO-FINALIZE-V1';
  var fired = false;
  var timer = 0;

  function text(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function bodyText() {
    var root = document.getElementById('app') || document.body;
    return text(root && root.innerText || '');
  }

  function completeScreen() {
    var s = bodyText();
    var runComplete = /(?:Fallback|Standard|Single)\s+Run\s+Complete/i.test(s);
    var fourSkills = /Reading[\s\S]{0,120}Complete/i.test(s) &&
      /Listening[\s\S]{0,120}Complete/i.test(s) &&
      /Writing[\s\S]{0,120}Complete/i.test(s) &&
      /Speaking[\s\S]{0,120}Complete/i.test(s);
    var bossGate = /Boss Gate\s*[1-5]/i.test(s);
    return runComplete && fourSkills && bossGate;
  }

  function tryFinalize() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (fired || !completeScreen()) return;
      if (!window.EAPBossCompleteNoLoop || typeof window.EAPBossCompleteNoLoop.finish !== 'function') return;
      fired = true;
      document.documentElement.dataset.eapBossAutoFinalizeVersion = VERSION;

      var buttons = document.querySelectorAll('button,a,[role="button"]');
      for (var i = 0; i < buttons.length; i++) {
        if (/Enter\s+Boss\s+Clash|Finish\s+Boss\s+Gate/i.test(text(buttons[i].textContent || ''))) {
          buttons[i].textContent = 'Finishing Boss Gate…';
          try { buttons[i].disabled = true; } catch (_) {}
        }
      }

      setTimeout(function () {
        try {
          window.EAPBossCompleteNoLoop.finish();
        } catch (err) {
          fired = false;
          console.error('[EAP Boss Auto Finalize] finalize failed', err);
        }
      }, 120);
    }, 80);
  }

  new MutationObserver(function () {
    if (!fired) tryFinalize();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener('load', tryFinalize);
  tryFinalize();
})();
