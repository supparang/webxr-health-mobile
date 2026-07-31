/* =========================================================
   EAP Word Quest • Summary CTA Authority
   Version: 20260731-EAPWQ-V292-SUMMARY-CTA-AUTHORITY

   Keeps the summary primary action consistent with the visible result:
   - failed current session -> ฝึก <session> ต่อ
   - passed current session -> ไปทำ <next> ต่อ
   - completed flow -> สรุปผลการเรียน

   No polling loop and no automatic reload.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V292-SUMMARY-CTA-AUTHORITY';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];

  if (window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V292__) return;
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

  function patch() {
    var screen = document.getElementById('summaryScreen');
    var button = document.getElementById('nextMissionBtn');
    var sessionId;
    var accuracy;
    var passed;
    var next;

    if (!screen || !button || !screen.classList.contains('active')) return;

    sessionId = currentSession();
    accuracy = visibleAccuracy();
    if (!sessionId || !Number.isFinite(accuracy)) return;

    passed = accuracy >= passThreshold(sessionId);
    next = nextSession(sessionId);

    if (!passed) {
      button.textContent = 'ฝึก ' + sessionId + ' ต่อ';
      button.setAttribute('aria-label', 'ฝึก ' + sessionId + ' ต่อ เพราะยังไม่ผ่านเกณฑ์');
      button.dataset.eapSummaryAction = 'retry-current';
    } else if (next === 'DONE') {
      button.textContent = 'สรุปผลการเรียน';
      button.setAttribute('aria-label', 'สรุปผลการเรียน');
      button.dataset.eapSummaryAction = 'complete';
    } else {
      button.textContent = 'ไปทำ ' + next + ' ต่อ';
      button.setAttribute('aria-label', 'ไปทำ ' + next + ' ต่อ');
      button.dataset.eapSummaryAction = 'advance';
    }

    if (receiptConfirmed()) {
      button.dataset.eapSheetConfirmed = 'true';
    }
  }

  function boundedPatch() {
    [0, 80, 250, 700, 1600].forEach(function (delay) {
      setTimeout(patch, delay);
    });
  }

  document.addEventListener('click', function (event) {
    if (event.target && event.target.closest && event.target.closest('#nextBtn,#quickStartBtn,.eap192-start,#replayBtn')) {
      boundedPatch();
    }
  }, true);

  window.addEventListener('eap-word-authority-ready', boundedPatch);
  window.addEventListener('pageshow', boundedPatch);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) boundedPatch();
  });

  boundedPatch();

  window.inspectEapWordSummaryCtaV292 = function () {
    var button = document.getElementById('nextMissionBtn');
    return {
      version: VERSION,
      sessionId: currentSession(),
      accuracy: visibleAccuracy(),
      label: text(button && button.textContent),
      action: button && button.dataset.eapSummaryAction || '',
      sheetConfirmed: button && button.dataset.eapSheetConfirmed === 'true'
    };
  };

  console.info('[EAP Word Quest] V292 summary CTA authority ready', { version: VERSION });
})();
