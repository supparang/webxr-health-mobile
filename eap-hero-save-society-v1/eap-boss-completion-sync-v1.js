/* =========================================================
   EAP Hero Boss Completion Sync v2
   Records a B1–B5 Boss Clash pass as a normal EAP attempt after the
   real core game shows “Boss Defeated!”. It remains separate from Boss
   Speaking review evidence and never fabricates a speaking note.
========================================================= */
(function () {
  'use strict';

  var CFG = window.EAP_SHEET_CONFIG || {};
  var ENDPOINT = String(CFG.webAppUrl || '');
  var QUEUE_KEY = 'EAP_HERO_BOSS_REVIEW_EVENT_QUEUE_V2';
  var LEGACY_QUEUE_KEY = 'EAP_HERO_BOSS_REVIEW_EVENT_QUEUE_V1';
  var SENT_KEY = 'EAP_HERO_BOSS_COMPLETION_SENT_V2';
  var timer = null;

  function text(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function read(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }

  function profile() {
    var state = read('EAP_HERO_PROGRESS_V3', {}) || {};
    var p = state.profile || state.player || {};
    return {
      studentId: text(p.studentId || p.id || state.studentId || 'guest'),
      studentName: text(p.studentName || p.name || state.studentName || 'Guest'),
      section: text(p.section || state.section || CFG.section || '122')
    };
  }

  function completedPage() {
    var body = text((document.getElementById('app') || document.body).innerText || '');
    return /Boss Defeated!/i.test(body);
  }

  function queueItems() {
    var merged = Object.assign({}, read(LEGACY_QUEUE_KEY, {}), read(QUEUE_KEY, {}));
    return Object.keys(merged).map(function (key) { return merged[key]; });
  }

  function currentBossEvidence() {
    var items = queueItems()
      .filter(function (item) {
        return item && item.event && /^B[1-5]$/i.test(text(item.event.sessionId)) &&
          item.event.value && item.event.value.teacherReviewRequired === true;
      })
      .sort(function (a, b) { return String(b.queuedAt || '').localeCompare(String(a.queuedAt || '')); });
    return items[0] || null;
  }

  function accuracy() {
    var body = text((document.getElementById('app') || document.body).innerText || '');
    var match = body.match(/(\d{1,3})%\s*Accuracy/i);
    return match ? Math.max(0, Math.min(100, Number(match[1]))) : 100;
  }

  function buildAttempt(item) {
    var event = item.event;
    var detail = event.value || {};
    var p = profile();
    var gate = text(event.sessionId || detail.sessionId).toUpperCase();
    var id = 'boss-clash-' + p.studentId + '-' + gate + '-' + text(event.eventId || detail.evidenceId);
    var acc = accuracy();

    return {
      action: 'submit_attempt',
      submissionKind: 'fresh_evidence_v118',
      attemptId: id,
      studentId: p.studentId,
      studentName: p.studentName,
      section: p.section,
      sessionId: gate,
      sessionTitle: text(detail.sessionTitle || ('Boss Gate ' + gate.replace('B', ''))),
      skill: 'Boss Clash',
      score: acc,
      accuracy: acc,
      passMark: 60,
      passed: true,
      legacyCompletion: false,
      hintUsed: 0,
      replay: false,
      clientTimestamp: new Date().toISOString(),
      sourceUrl: location.href,
      bossWin: true,
      bossEvidenceId: text(event.eventId || detail.evidenceId)
    };
  }

  function send(attempt) {
    if (!ENDPOINT || !attempt) return false;
    var sent = read(SENT_KEY, {});
    if (sent[attempt.attemptId]) return true;

    try {
      var url = new URL(ENDPOINT, location.href);
      Object.keys(attempt).forEach(function (key) {
        url.searchParams.set(key, String(attempt[key]));
      });
      fetch(url.toString()).catch(function () {});
      sent[attempt.attemptId] = { at: new Date().toISOString(), score: attempt.score };
      write(SENT_KEY, sent);
      return true;
    } catch (_) {
      return false;
    }
  }

  function sync() {
    if (!completedPage()) return;
    var item = currentBossEvidence();
    if (!item) return;
    send(buildAttempt(item));
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(sync, 260);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('load', schedule);
  window.EAPBossCompletionSyncV1 = { sync:sync };
})();
