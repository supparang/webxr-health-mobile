/* =========================================================
   EAP Word Quest • Summary Actions Authority
   Version: 20260731-EAPWQ-V294-LIVE-SUMMARY-ACTIONS

   Keeps summary actions consistent with the visible result:
   - failed current session -> ฝึก <session> ต่อ
   - passed current session -> ไปทำ <next> ต่อ
   - replay button -> เล่น <current session> อีกครั้ง
   - completed flow -> สรุปผลการเรียน

   Uses one observer scoped to #summaryScreen only.
   No polling loop and no automatic reload.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V294-LIVE-SUMMARY-ACTIONS';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var observer = null;
  var scheduled = false;
  var applying = false;

  if (window.__EAP_WORD_SUMMARY_ACTIONS_V294__) return;
  window.__EAP_WORD_SUMMARY_ACTIONS_V294__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V293__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V292__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function currentSession() {
    var title = text(document.getElementById('summaryTitle') && document.getElementById('summaryTitle').textContent).toUpperCase();
    var subtitle = text(document.getElementById('summarySubtitle') && document.getElementById('summarySubtitle').textContent).toUpperCase();
    var match = (title + ' ' + subtitle).match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
    return match ? match[1] : '';
  }

  function visibleAccuracy() {
    var subtitle = text(document.getElementById('summarySubtitle') && document.getElementById('summarySubtitle').textContent);
    var stats = text(document.getElementById('summaryStats') && document.getElementById('summaryStats').textContent);
    var match = (subtitle + ' ' + stats).match(/(\d{1,3})\s*%/);
    return match ? Number(match[1]) : NaN;
  }

  function passThreshold(sessionId) {
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function receiptConfirmed() {
    var screen = document.getElementById('summaryScreen');
    var body = text(screen && screen.textContent);
    return /บันทึกและยืนยันจาก Google Sheet แล้ว|ยืนยันจาก Google Sheet แล้ว/.test(body);
  }

  function nextSession(sessionId) {
    var index = FLOW.indexOf(sessionId);
    return index >= 0 && index < FLOW.length - 1 ? FLOW[index + 1] : 'DONE';
  }

  function setLabel(button, label, ariaLabel) {
    if (!button) return;
    if (text(button.textContent) !== label) button.textContent = label;
    if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
  }

  function patch() {
    var screen = document.getElementById('summaryScreen');
    var nextButton = document.getElementById('nextMissionBtn');
    var replayButton = document.getElementById('replayBtn');
    var sessionId;
    var accuracy;
    var passed;
    var next;

    if (applying || !screen || !screen.classList.contains('active')) return;

    sessionId = currentSession();
    accuracy = visibleAccuracy();
    if (!sessionId || !Number.isFinite(accuracy)) return;

    applying = true;
    try {
      setLabel(replayButton, 'เล่น ' + sessionId + ' อีกครั้ง', 'เล่น ' + sessionId + ' อีกครั้ง');
      if (replayButton) replayButton.dataset.eapReplaySession = sessionId;

      if (!nextButton) return;

      passed = accuracy >= passThreshold(sessionId);
      next = nextSession(sessionId);

      if (!passed) {
        setLabel(nextButton, 'ฝึก ' + sessionId + ' ต่อ', 'ฝึก ' + sessionId + ' ต่อ เพราะยังไม่ผ่านเกณฑ์');
        nextButton.dataset.eapSummaryAction = 'retry-current';
      } else if (next === 'DONE') {
        setLabel(nextButton, 'สรุปผลการเรียน', 'สรุปผลการเรียน');
        nextButton.dataset.eapSummaryAction = 'complete';
      } else {
        setLabel(nextButton, 'ไปทำ ' + next + ' ต่อ', 'ไปทำ ' + next + ' ต่อ');
        nextButton.dataset.eapSummaryAction = 'advance';
      }

      if (receiptConfirmed()) nextButton.dataset.eapSheetConfirmed = 'true';
    } finally {
      applying = false;
    }
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      patch();
    });
  }

  function connectObserver() {
    var screen = document.getElementById('summaryScreen');
    if (!screen || observer) return;
    observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        var target = mutation.target && mutation.target.nodeType === 3 ? mutation.target.parentElement : mutation.target;
        if (!target || !target.closest) return false;
        return Boolean(target.closest('#summaryTitle,#summarySubtitle,#summaryStats,#nextMissionBtn,#replayBtn,#summaryScreen'));
      });
      if (relevant && !applying) schedulePatch();
    });
    observer.observe(screen, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
  }

  function activate() {
    connectObserver();
    schedulePatch();
    [60, 220, 700, 1800].forEach(function (delay) { setTimeout(schedulePatch, delay); });
  }

  document.addEventListener('click', function (event) {
    if (event.target && event.target.closest && event.target.closest('#nextBtn,#quickStartBtn,.eap192-start,#replayBtn,#nextMissionBtn')) activate();
  }, true);

  window.addEventListener('eap-word-authority-ready', activate);
  window.addEventListener('pageshow', activate);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) activate();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once:true });
  else activate();

  window.inspectEapWordSummaryActionsV294 = function () {
    var nextButton = document.getElementById('nextMissionBtn');
    var replayButton = document.getElementById('replayBtn');
    return {
      version: VERSION,
      sessionId: currentSession(),
      accuracy: visibleAccuracy(),
      nextLabel: text(nextButton && nextButton.textContent),
      replayLabel: text(replayButton && replayButton.textContent),
      replaySession: replayButton && replayButton.dataset.eapReplaySession || '',
      action: nextButton && nextButton.dataset.eapSummaryAction || '',
      sheetConfirmed: nextButton && nextButton.dataset.eapSheetConfirmed === 'true',
      observerConnected: Boolean(observer)
    };
  };

  console.info('[EAP Word Quest] V294 live summary actions ready', { version: VERSION });
})();
