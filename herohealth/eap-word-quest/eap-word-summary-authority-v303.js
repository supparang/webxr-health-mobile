/* =========================================================
   EAP Word Quest • Summary Authority with Review Mode
   Version: 20260801-EAPWQ-V303-REVIEW-SUMMARY
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260801-EAPWQ-V303-REVIEW-SUMMARY';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var observer = null;
  var scheduled = false;
  var applying = false;

  if (window.__EAP_WORD_V303_REVIEW_SUMMARY__) return;
  window.__EAP_WORD_V303_REVIEW_SUMMARY__ = true;
  window.__EAP_WORD_SUMMARY_ACTIONS_V294__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V292__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V293__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V298__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V299__ = true;
  window.__EAP_WORD_SUMMARY_CTA_AUTHORITY_V300__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function reviewContext() {
    var value = null;
    try {
      if (typeof window.getEapWordReviewContextV301 === 'function') value = window.getEapWordReviewContextV301();
    } catch (ignore) {}
    return value && value.active ? value : { active:false };
  }

  function currentSession() {
    var review = reviewContext();
    var title = text(byId('summaryTitle') && byId('summaryTitle').textContent).toUpperCase();
    var subtitle = text(byId('summarySubtitle') && byId('summarySubtitle').textContent).toUpperCase();
    var match = (title + ' ' + subtitle).match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
    if (review.active && FLOW.indexOf(text(review.parentSessionId).toUpperCase()) >= 0) {
      return text(review.parentSessionId).toUpperCase();
    }
    return match ? match[1] : '';
  }

  function visibleAccuracy() {
    var subtitle = text(byId('summarySubtitle') && byId('summarySubtitle').textContent);
    var stats = text(byId('summaryStats') && byId('summaryStats').textContent);
    var match = (subtitle + ' ' + stats).match(/(\d{1,3})\s*%/);
    return match ? Number(match[1]) : NaN;
  }

  function passThreshold(sessionId) {
    if (reviewContext().active) return 60;
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
    var value = receiptText();
    return /บันทึกและยืนยันจาก Google Sheet แล้ว|ยืนยันจาก Google Sheet แล้ว|ผลทบทวนคำที่พลาด.+บันทึกใน Google Sheet แล้ว/.test(value);
  }

  function sheetAuthorityDone() {
    var value = receiptText();
    if (!receiptConfirmed()) return false;
    return /เล่นต่อที่\s*DONE\b/i.test(value) || /ความก้าวหน้า\s*100\s*%/i.test(value) || /สำเร็จครบทุกภารกิจ/i.test(value);
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

  function setSingleHomeAction(enabled) {
    var screen = byId('summaryScreen');
    var home = byId('homeBtn');
    if (!screen || !home) return;
    if (enabled) {
      screen.dataset.eapSingleHomeAction = 'true';
      home.dataset.eapHiddenByV303 = 'true';
      home.hidden = true;
      home.style.setProperty('display', 'none', 'important');
      home.setAttribute('aria-hidden', 'true');
      home.setAttribute('tabindex', '-1');
      return;
    }
    if (home.dataset.eapHiddenByV303 === 'true') {
      delete screen.dataset.eapSingleHomeAction;
      delete home.dataset.eapHiddenByV303;
      home.hidden = false;
      home.style.removeProperty('display');
      home.removeAttribute('aria-hidden');
      home.removeAttribute('tabindex');
    }
  }

  function patchReviewCopy(sessionId, accuracy) {
    var review = reviewContext();
    var title = byId('summaryTitle');
    var subtitle = byId('summarySubtitle');
    var stats = byId('summaryStats');
    if (!review.active) return;
    if (title) title.textContent = 'ฝึกคำที่พลาดของ ' + sessionId + ' เสร็จแล้ว!';
    if (subtitle) subtitle.textContent = 'Weak Words Review • ' + Math.round(accuracy) + '% • ไม่กระทบคะแนน Core';
    if (stats) {
      Array.prototype.forEach.call(stats.querySelectorAll('*'), function (node) {
        if (node.children.length === 0 && text(node.textContent) === 'ผ่านแล้ว') node.textContent = 'ทบทวนเสร็จแล้ว';
      });
    }
  }

  function patch() {
    var screen = byId('summaryScreen');
    var nextButton = byId('nextMissionBtn');
    var replayButton = byId('replayBtn');
    var review = reviewContext();
    var sessionId;
    var accuracy;
    var passed;
    var next;
    var authorityDone;
    var reviewConfirmed;

    if (applying || !screen || !screen.classList.contains('active')) return;
    sessionId = currentSession();
    accuracy = visibleAccuracy();
    if (!sessionId || !Number.isFinite(accuracy)) return;

    applying = true;
    try {
      patchReviewCopy(sessionId, accuracy);
      if (review.active) {
        setLabel(replayButton, 'ฝึกคำที่พลาดอีกครั้ง', 'ฝึกคำที่พลาดของ ' + sessionId + ' อีกครั้ง');
        if (replayButton) replayButton.dataset.eapReplayReview = 'true';
      } else {
        setLabel(replayButton, 'เล่น ' + sessionId + ' อีกครั้ง', 'เล่น ' + sessionId + ' อีกครั้ง');
        if (replayButton) delete replayButton.dataset.eapReplayReview;
      }
      if (!nextButton) return;

      authorityDone = sheetAuthorityDone();
      reviewConfirmed = review.active && receiptConfirmed();
      passed = accuracy >= passThreshold(sessionId);
      next = nextSession(sessionId);
      setSingleHomeAction(authorityDone || reviewConfirmed);

      if (reviewConfirmed) {
        setLabel(nextButton, 'กลับหน้าหลัก', 'กลับหน้าหลักหลังทบทวนคำที่พลาด');
        nextButton.dataset.eapSummaryAction = 'completed-home';
        nextButton.dataset.eapReviewConfirmed = 'true';
        nextButton.dataset.eapSheetConfirmed = 'true';
        nextButton.title = 'ผลทบทวนบันทึกแล้ว และไม่กระทบคะแนน Core';
        nextButton.disabled = false;
        nextButton.setAttribute('aria-disabled', 'false');
        nextButton.style.removeProperty('opacity');
        nextButton.style.removeProperty('cursor');
      } else if (authorityDone) {
        setLabel(nextButton, 'กลับหน้าหลัก', 'กลับหน้าหลักหลังจบ EAP Word Quest');
        nextButton.dataset.eapSummaryAction = 'completed-home';
        nextButton.dataset.eapSheetDone = 'true';
        nextButton.dataset.eapSheetConfirmed = 'true';
        nextButton.disabled = false;
        nextButton.setAttribute('aria-disabled', 'false');
        nextButton.style.removeProperty('opacity');
        nextButton.style.removeProperty('cursor');
      } else if (!passed) {
        setLabel(nextButton, review.active ? 'กลับหน้าหลัก' : 'ฝึก ' + sessionId + ' ต่อ', review.active ? 'กลับหน้าหลักหลังทบทวน' : 'ฝึก ' + sessionId + ' ต่อ เพราะยังไม่ผ่านเกณฑ์');
        nextButton.dataset.eapSummaryAction = review.active ? 'completed-home' : 'retry-current';
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
    requestAnimationFrame(function () { scheduled = false; patch(); });
  }

  function connectObserver() {
    var screen = byId('summaryScreen');
    if (!screen || observer) return;
    observer = new MutationObserver(function () { if (!applying) schedulePatch(); });
    observer.observe(screen, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
  }

  function activate() {
    connectObserver();
    schedulePatch();
    [60,220,700,1800].forEach(function (delay) { setTimeout(schedulePatch, delay); });
  }

  document.addEventListener('click', function (event) {
    var completedButton = event.target && event.target.closest ? event.target.closest('#nextMissionBtn[data-eap-summary-action="completed-home"]') : null;
    var home;
    if (completedButton && receiptConfirmed()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      home = byId('homeBtn');
      if (home) home.click();
      return;
    }
    if (event.target && event.target.closest && event.target.closest('#nextBtn,#quickStartBtn,.eap192-start,#replayBtn,#nextMissionBtn')) activate();
  }, true);

  window.addEventListener('eap-word-review-context-changed', activate);
  window.addEventListener('eap-word-sheet-receipt-confirmed', activate);
  window.addEventListener('eap-word-authority-ready', activate);
  window.addEventListener('pageshow', activate);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) activate(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once:true });
  else activate();

  window.inspectEapWordSummaryAuthorityV303 = function () {
    var nextButton = byId('nextMissionBtn');
    var replayButton = byId('replayBtn');
    var home = byId('homeBtn');
    return {
      version:VERSION,
      review:reviewContext(),
      sessionId:currentSession(),
      accuracy:visibleAccuracy(),
      nextLabel:text(nextButton && nextButton.textContent),
      replayLabel:text(replayButton && replayButton.textContent),
      action:nextButton && nextButton.dataset.eapSummaryAction || '',
      receipt:receiptText(),
      sheetAuthorityDone:sheetAuthorityDone(),
      duplicateHomeHidden:Boolean(home && home.dataset.eapHiddenByV303 === 'true'),
      observerConnected:Boolean(observer)
    };
  };

  console.info('[EAP Word Quest] V303 review summary authority ready', { version:VERSION });
})();