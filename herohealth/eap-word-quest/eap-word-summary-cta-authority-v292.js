/* =========================================================
   EAP Word Quest • Summary Actions Authority
   Version: 20260801-EAPWQ-V299-FRIENDLY-DONE-SUMMARY

   Keeps summary actions consistent with the visible result and
   gives Google Sheet completion authority priority over the local
   session sequence:
   - Sheet confirms DONE / 100% -> กลับหน้าหลัก
   - Internal DONE is replaced with learner-friendly completion text
   - failed current session -> ฝึก <session> ต่อ
   - passed current session -> ไปทำ <next> ต่อ
   - replay button -> เล่น <current session> อีกครั้ง

   Uses one observer scoped to #summaryScreen only.
   No polling loop and no automatic reload.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260801-EAPWQ-V299-FRIENDLY-DONE-SUMMARY';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var observer = null;
  var scheduled = false;
  var applying = false;

  if (window.__EAP_WORD_SUMMARY_ACTIONS_V294__) return;
  window.__EAP_WORD_SUMMARY_ACTIONS_V294__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V293__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V292__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V298__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V299__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function currentSession() {
    var title = text(byId('summaryTitle') && byId('summaryTitle').textContent).toUpperCase();
    var subtitle = text(byId('summarySubtitle') && byId('summarySubtitle').textContent).toUpperCase();
    var match = (title + ' ' + subtitle).match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
    return match ? match[1] : '';
  }

  function visibleAccuracy() {
    var subtitle = text(byId('summarySubtitle') && byId('summarySubtitle').textContent);
    var stats = text(byId('summaryStats') && byId('summaryStats').textContent);
    var match = (subtitle + ' ' + stats).match(/(\d{1,3})\s*%/);
    return match ? Number(match[1]) : NaN;
  }

  function passThreshold(sessionId) {
    if (sessionId === 'BG5') return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function receiptNode() {
    return byId('eapWordExactSummaryStatus');
  }

  function receiptText() {
    var node = receiptNode();
    return text(node && node.textContent);
  }

  function receiptConfirmed() {
    return /บันทึกและยืนยันจาก Google Sheet แล้ว|ยืนยันจาก Google Sheet แล้ว/.test(receiptText());
  }

  function sheetAuthorityDone() {
    var value = receiptText();
    if (!receiptConfirmed()) return false;
    return /เล่นต่อที่\s*DONE\b/i.test(value) ||
      /ความก้าวหน้า\s*100\s*%/i.test(value) ||
      /สำเร็จครบทุกภารกิจ/i.test(value);
  }

  function friendlyDoneReceipt(sessionId) {
    var node = receiptNode();
    var desired;
    if (!node || !sheetAuthorityDone()) return;
    desired = sessionId + ' บันทึกและยืนยันจาก Google Sheet แล้ว ✓ สำเร็จครบทุกภารกิจ • ความก้าวหน้า 100%';
    if (text(node.textContent) !== desired) node.textContent = desired;
    if (node.dataset.eapFriendlyDone !== 'true') node.dataset.eapFriendlyDone = 'true';
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

  function clearSheetDoneState(button) {
    if (!button || !button.dataset) return;
    if (button.dataset.eapSummaryAction === 'completed-home') delete button.dataset.eapSummaryAction;
    if (button.dataset.eapSheetDone === 'true') delete button.dataset.eapSheetDone;
  }

  function patch() {
    var screen = byId('summaryScreen');
    var nextButton = byId('nextMissionBtn');
    var replayButton = byId('replayBtn');
    var sessionId;
    var accuracy;
    var passed;
    var next;
    var authorityDone;

    if (applying || !screen || !screen.classList.contains('active')) return;

    sessionId = currentSession();
    accuracy = visibleAccuracy();
    if (!sessionId || !Number.isFinite(accuracy)) return;

    applying = true;
    try {
      setLabel(replayButton, 'เล่น ' + sessionId + ' อีกครั้ง', 'เล่น ' + sessionId + ' อีกครั้ง');
      if (replayButton) replayButton.dataset.eapReplaySession = sessionId;

      if (!nextButton) return;

      authorityDone = sheetAuthorityDone();
      passed = accuracy >= passThreshold(sessionId);
      next = nextSession(sessionId);

      if (authorityDone) {
        friendlyDoneReceipt(sessionId);
        setLabel(nextButton, 'กลับหน้าหลัก', 'กลับหน้าหลักหลังจบ EAP Word Quest');
        nextButton.dataset.eapSummaryAction = 'completed-home';
        nextButton.dataset.eapSheetDone = 'true';
        nextButton.dataset.eapSheetConfirmed = 'true';
        nextButton.title = 'Google Sheet ยืนยันความก้าวหน้า 100% แล้ว';
        nextButton.disabled = false;
        nextButton.setAttribute('aria-disabled', 'false');
        nextButton.style.removeProperty('opacity');
        nextButton.style.removeProperty('cursor');
      } else if (!passed) {
        clearSheetDoneState(nextButton);
        setLabel(nextButton, 'ฝึก ' + sessionId + ' ต่อ', 'ฝึก ' + sessionId + ' ต่อ เพราะยังไม่ผ่านเกณฑ์');
        nextButton.dataset.eapSummaryAction = 'retry-current';
      } else if (next === 'DONE') {
        clearSheetDoneState(nextButton);
        setLabel(nextButton, 'สรุปผลการเรียน', 'สรุปผลการเรียน');
        nextButton.dataset.eapSummaryAction = 'complete';
      } else {
        clearSheetDoneState(nextButton);
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
    var screen = byId('summaryScreen');
    if (!screen || observer) return;
    observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        var target = mutation.target && mutation.target.nodeType === 3 ? mutation.target.parentElement : mutation.target;
        if (!target || !target.closest) return false;
        return Boolean(target.closest('#summaryTitle,#summarySubtitle,#summaryStats,#eapWordExactSummaryStatus,#nextMissionBtn,#replayBtn,#summaryScreen'));
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
    var completedButton = event.target && event.target.closest
      ? event.target.closest('#nextMissionBtn[data-eap-summary-action="completed-home"]')
      : null;
    var home;

    if (completedButton && sheetAuthorityDone()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      home = byId('homeBtn');
      if (home) home.click();
      return;
    }

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
    var nextButton = byId('nextMissionBtn');
    var replayButton = byId('replayBtn');
    return {
      version: VERSION,
      sessionId: currentSession(),
      accuracy: visibleAccuracy(),
      nextLabel: text(nextButton && nextButton.textContent),
      replayLabel: text(replayButton && replayButton.textContent),
      replaySession: replayButton && replayButton.dataset.eapReplaySession || '',
      action: nextButton && nextButton.dataset.eapSummaryAction || '',
      sheetConfirmed: nextButton && nextButton.dataset.eapSheetConfirmed === 'true',
      sheetAuthorityDone: sheetAuthorityDone(),
      receipt: receiptText(),
      observerConnected: Boolean(observer)
    };
  };

  console.info('[EAP Word Quest] V299 friendly DONE summary ready', { version: VERSION });
})();