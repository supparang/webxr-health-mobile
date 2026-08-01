/* =========================================================
   EAP Word Quest • Weak Words Review Mode Authority
   Version: 20260801-EAPWQ-V301-WEAK-REVIEW-MODE

   Separates Weak Words review from Core session attempts.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260801-EAPWQ-V301-WEAK-REVIEW-MODE';
  var CONTEXT_KEY = 'EAP_WORD_REVIEW_CONTEXT_V301';
  var COUNT_KEY = 'EAP_WORD_REVIEW_COUNTS_V301';
  var originalAppendChild;
  var observer = null;
  var scheduled = false;
  var applying = false;

  if (window.__EAP_WORD_V301_WEAK_REVIEW_MODE__) return;
  window.__EAP_WORD_V301_WEAK_REVIEW_MODE__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function readJson(key, fallback) {
    try {
      var parsed = JSON.parse(sessionStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (ignore) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (ignore) {}
  }

  function sessionFromSummary() {
    var title = text(document.getElementById('summaryTitle') && document.getElementById('summaryTitle').textContent);
    var subtitle = text(document.getElementById('summarySubtitle') && document.getElementById('summarySubtitle').textContent);
    var match = (title + ' ' + subtitle).match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/i);
    return match ? match[1].toUpperCase() : '';
  }

  function context() {
    var current = window.EAP_WORD_REVIEW_CONTEXT;
    if (current && current.active) return current;
    current = readJson(CONTEXT_KEY, {});
    if (current && current.active) {
      window.EAP_WORD_REVIEW_CONTEXT = current;
      return current;
    }
    return { active:false };
  }

  function nextReviewAttempt(parentSessionId) {
    var counts = readJson(COUNT_KEY, {});
    var key = parentSessionId || 'MIXED';
    counts[key] = Math.max(0, Number(counts[key] || 0)) + 1;
    writeJson(COUNT_KEY, counts);
    return counts[key];
  }

  function activateReview(parentSessionId, source) {
    var parent = text(parentSessionId || sessionFromSummary() || 'MIXED').toUpperCase();
    var next = {
      active:true,
      parentSessionId:parent,
      practiceMode:'weak_words',
      sessionType:'weak_review',
      countTowardCore:false,
      countTowardProgress:false,
      reviewAttempt:nextReviewAttempt(parent),
      source:text(source || 'weak_words_button'),
      startedAt:new Date().toISOString()
    };
    window.EAP_WORD_REVIEW_CONTEXT = next;
    writeJson(CONTEXT_KEY, next);
    window.dispatchEvent(new CustomEvent('eap-word-review-context-changed', { detail:next }));
    schedulePatch();
    return next;
  }

  function clearReview(reason) {
    var previous = context();
    if (!previous.active) return;
    window.EAP_WORD_REVIEW_CONTEXT = { active:false, clearedAt:new Date().toISOString(), reason:text(reason || '') };
    try { sessionStorage.removeItem(CONTEXT_KEY); } catch (ignore) {}
    window.dispatchEvent(new CustomEvent('eap-word-review-context-changed', { detail:window.EAP_WORD_REVIEW_CONTEXT }));
    schedulePatch();
  }

  function isReviewButton(button) {
    var label = text(button && button.textContent);
    return Boolean(button && (
      button.id === 'weakStartBtn' ||
      /ฝึกคำที่(?:เคย)?ผิด|ฝึกคำที่พลาด|weak\s*words?/i.test(label)
    ));
  }

  function mergeExtraJson(url, review) {
    var extra = {};
    try { extra = JSON.parse(url.searchParams.get('extraJson') || '{}') || {}; } catch (ignore) {}
    extra.reviewModeVersion = VERSION;
    extra.practiceMode = 'weak_words';
    extra.parentSessionId = review.parentSessionId;
    extra.countTowardCore = false;
    extra.countTowardProgress = false;
    extra.reviewAttempt = review.reviewAttempt;
    extra.reviewSource = review.source;
    url.searchParams.set('extraJson', JSON.stringify(extra));
  }

  function enrichReviewSubmit(node) {
    var url;
    var review = context();
    var sessionId;
    var accuracy;
    if (!review.active || !node || String(node.tagName).toUpperCase() !== 'SCRIPT' || !node.src) return;
    try { url = new URL(node.src, location.href); } catch (ignore) { return; }
    if (url.searchParams.get('action') !== 'eap_word_submit_jsonp') return;

    sessionId = text(url.searchParams.get('sessionId')).toUpperCase();
    if (!sessionId) return;
    if (!review.parentSessionId || review.parentSessionId === 'MIXED') review.parentSessionId = sessionId;
    accuracy = Number(url.searchParams.get('accuracy') || 0);

    url.searchParams.set('sessionType', 'weak_review');
    url.searchParams.set('practiceMode', 'weak_words');
    url.searchParams.set('parentSessionId', review.parentSessionId || sessionId);
    url.searchParams.set('countTowardCore', 'false');
    url.searchParams.set('countTowardProgress', 'false');
    url.searchParams.set('reviewAttempt', String(review.reviewAttempt || 1));
    url.searchParams.set('reviewSource', review.source || 'weak_words_button');
    url.searchParams.set('isBoss', 'false');
    url.searchParams.set('passStatus', accuracy >= 60 ? 'Review Completed' : 'Review Practice');
    url.searchParams.set('attempt', String(review.reviewAttempt || 1));
    url.searchParams.set('source', 'v301-weak-review-jsonp');
    url.searchParams.set('schemaVersion', VERSION);
    url.searchParams.set('sessionTitle', text(url.searchParams.get('sessionTitle') || sessionId) + ' — Weak Words Review');
    mergeExtraJson(url, review);
    node.src = url.toString();
  }

  function patchGame() {
    var review = context();
    var game = document.getElementById('gameScreen');
    var mode = document.getElementById('gameModeText');
    var title = document.getElementById('gameTitle');
    if (!review.active || !game || !game.classList.contains('active')) return;
    if (mode && text(mode.textContent) !== 'Weak Words Review • ' + review.parentSessionId) {
      mode.textContent = 'Weak Words Review • ' + review.parentSessionId;
    }
    if (title && text(title.textContent) !== 'ฝึกคำที่พลาดของ ' + review.parentSessionId) {
      title.textContent = 'ฝึกคำที่พลาดของ ' + review.parentSessionId;
    }
  }

  function patchSummary() {
    var review = context();
    var screen = document.getElementById('summaryScreen');
    var title = document.getElementById('summaryTitle');
    var subtitle = document.getElementById('summarySubtitle');
    var stats = document.getElementById('summaryStats');
    var accuracyMatch;
    var accuracy;
    if (!review.active || !screen || !screen.classList.contains('active')) return;

    accuracyMatch = text(subtitle && subtitle.textContent).match(/(\d{1,3})\s*%/);
    accuracy = accuracyMatch ? accuracyMatch[1] : '';

    if (title) title.textContent = 'ฝึกคำที่พลาดของ ' + review.parentSessionId + ' เสร็จแล้ว!';
    if (subtitle) subtitle.textContent = 'Weak Words Review' + (accuracy ? ' • ' + accuracy + '%' : '') + ' • ไม่กระทบคะแนน Core';

    if (stats) {
      Array.prototype.forEach.call(stats.querySelectorAll('*'), function (node) {
        if (node.children.length === 0 && text(node.textContent) === 'ผ่านแล้ว') node.textContent = 'ทบทวนเสร็จแล้ว';
      });
    }
    screen.dataset.eapReviewMode = 'true';
  }

  function patch() {
    if (applying) return;
    applying = true;
    try {
      patchGame();
      patchSummary();
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

  originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    if (this === document.head) enrichReviewSubmit(node);
    return originalAppendChild.call(this, node);
  };

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('button') : null;
    var review = context();
    if (!button) return;

    if (button.id === 'replayBtn' && review.active) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activateReview(review.parentSessionId, 'review_replay');
      var weak = document.getElementById('weakStartBtn');
      if (weak) weak.click();
      return;
    }

    if (isReviewButton(button)) {
      activateReview(sessionFromSummary() || review.parentSessionId || 'MIXED',
        button.id === 'weakStartBtn' ? 'home_weak_words' : 'summary_weak_words');
      setTimeout(schedulePatch, 0);
      return;
    }

    if (button.id === 'quickStartBtn' || button.id === 'nextMissionBtn' ||
        button.classList.contains('eap192-start') ||
        (button.closest && button.closest('.session-card'))) {
      clearReview('normal_session_start');
    }

    if (button.id === 'homeBtn' ||
        (button.id === 'nextMissionBtn' && button.dataset.eapSummaryAction === 'completed-home')) {
      setTimeout(function () { clearReview('return_home'); }, 0);
    }
  }, true);

  function connectObserver() {
    if (observer) return;
    observer = new MutationObserver(function () {
      if (!applying) schedulePatch();
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
  }

  window.getEapWordReviewContextV301 = function () {
    return Object.assign({}, context());
  };
  window.clearEapWordReviewContextV301 = clearReview;
  window.inspectEapWordReviewModeV301 = function () {
    return { version:VERSION, context:context() };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      connectObserver();
      schedulePatch();
    }, { once:true });
  } else {
    connectObserver();
    schedulePatch();
  }

  console.info('[EAP Word Quest] V301 weak review mode ready', { version:VERSION });
})();