/* =========================================================
   EAP Hero • Boss Completion Retry v164
   - Repairs completed Boss Gate rows that were shown locally but not
     persisted to Google Sheet.
   - Reads the Sheet endpoint at send time (not only at script load).
   - Uses a new idempotent completion ID version so failed v5 sends retry.
   - Retries POST delivery and then refreshes Cloud Resume.
   - Never advances official progression locally.
========================================================= */
(function () {
  'use strict';
  if (window.__EAP_BOSS_COMPLETION_RETRY_V164__) return;
  window.__EAP_BOSS_COMPLETION_RETRY_V164__ = true;

  var VERSION = '20260723-EAP-BOSS-COMPLETION-RETRY-V164';
  var SKILLS = ['Reading', 'Listening', 'Writing', 'Speaking'];
  var retryTimers = [];
  var lastSignature = '';

  function text(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function endpoint() {
    var cfg = window.EAP_SHEET_CONFIG || {};
    return text(cfg.webAppUrl || cfg.url || cfg.endpoint || '');
  }

  function profile() {
    var state = read('EAP_HERO_PROGRESS_V3', {}) || {};
    var stored = read('EAP_HERO_PLAYER_PROFILE_V1', {}) || {};
    var p = Object.assign({}, state.profile || {}, state.player || {}, stored || {});
    return {
      studentId: text(p.studentId || p.id || state.studentId || ''),
      studentName: text(p.studentName || p.name || state.studentName || state.playerName || ''),
      section: text(p.section || state.section || (window.EAP_SHEET_CONFIG || {}).section || '122')
    };
  }

  function pageText() {
    var root = document.getElementById('app') || document.body;
    return text(root && root.innerText || '');
  }

  function gateFrom(source) {
    var s = text(source);
    var m = s.match(/\bB([1-5])\s*(?:Boss\s*Gate|Gate)?\b/i) || s.match(/Boss\s*Gate\s*([1-5])/i);
    if (m) return 'B' + Number(m[1]);
    if (/Detail\s+Trap\s+Spider/i.test(s)) return 'B1';
    if (/Copy\s*-?\s*Paste\s+Zombie/i.test(s)) return 'B2';
    if (/Broken\s+Paragraph\s+Beast|Structure\s+Maze\s+Warden/i.test(s)) return 'B3';
    if (/Plagiarism\s+Monster|Rude\s+Mail\s+Gremlin|Graph\s+Fog\s+Dragon/i.test(s)) return 'B4';
    if (/Stagnation\s+Emperor|Final\s+Academic\s+Mission/i.test(s)) return 'B5';
    return '';
  }

  function titleFor(gate) {
    return {
      B1: 'Boss Gate 1: Academic Foundations',
      B2: 'Boss Gate 2: Reading, Listening and Summary',
      B3: 'Boss Gate 3: Academic Writing Control',
      B4: 'Boss Gate 4: Academic Communication and Ethics',
      B5: 'Boss Gate 5: Final Academic Mission'
    }[gate] || gate;
  }

  function defeated() {
    return /Boss\s+Defeated!/i.test(pageText());
  }

  function buildAttempt(gate, skill, runId) {
    var p = profile();
    var title = titleFor(gate);
    return {
      action: 'submit_attempt',
      submissionKind: 'fresh_evidence_v118',
      attemptId: 'boss-complete-v164-' + p.studentId + '-' + gate + '-' + skill.toLowerCase().replace(/\s+/g, '-') + '-' + runId,
      studentId: p.studentId,
      studentName: p.studentName,
      section: p.section,
      course: 'EAP Hero: Save the Society',
      routeId: gate,
      routeType: 'boss_gate',
      sessionId: gate,
      sessionTitle: title,
      routeTitle: title,
      skill: skill,
      skillRole: skill === 'Boss Clash' ? 'Completion' : 'Integrated',
      score: 100,
      accuracy: 100,
      passMark: 60,
      passed: true,
      completed: true,
      complete: true,
      bossWin: true,
      bossGateComplete: true,
      legacyCompletion: false,
      teacherReviewRequired: false,
      replay: false,
      clientTimestamp: new Date().toISOString(),
      sourceUrl: location.href,
      bossCompletionSyncVersion: VERSION
    };
  }

  function send(attempt) {
    var url = endpoint();
    if (!url || !attempt || !attempt.studentId) return Promise.resolve(false);
    return fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(attempt)
    }).then(function () { return true; }).catch(function () { return false; });
  }

  function resumeSync(delay) {
    setTimeout(function () {
      try {
        if (window.EAPPlayerResume && typeof window.EAPPlayerResume.sync === 'function') {
          window.EAPPlayerResume.sync({ silent: true, force: true });
        }
      } catch (_) {}
    }, delay);
  }

  function perform(gate, source) {
    var p = profile();
    if (!gate || !p.studentId || p.studentId === 'guest') return;
    var signature = p.studentId + '|' + p.section + '|' + gate;
    if (lastSignature === signature) return;
    lastSignature = signature;

    var runId = Date.now().toString(36);
    var attempts = SKILLS.concat(['Boss Clash']).map(function (skill) {
      return buildAttempt(gate, skill, runId);
    });

    function batch() {
      attempts.forEach(function (attempt) { send(attempt); });
    }

    batch();
    retryTimers.push(setTimeout(batch, 1800));
    retryTimers.push(setTimeout(batch, 5200));
    resumeSync(2600);
    resumeSync(6500);
    resumeSync(10000);

    try {
      window.dispatchEvent(new CustomEvent('eap:boss-completion-sync-started', {
        detail: { gate: gate, source: source || 'visible_defeated', version: VERSION }
      }));
    } catch (_) {}
  }

  function scan(source) {
    if (!defeated()) return;
    perform(gateFrom(pageText()), source);
  }

  window.addEventListener('eap:boss-defeated-visible', function (event) {
    var detail = event && event.detail || {};
    perform(gateFrom(detail.gate || pageText()), 'boss-defeated-event');
  });

  new MutationObserver(function () { scan('mutation'); }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener('load', function () {
    setTimeout(function () { scan('load'); }, 150);
  });

  window.EAPBossCompletionRetryV164 = {
    version: VERSION,
    sync: function () { lastSignature = ''; scan('manual'); },
    endpoint: endpoint
  };

  scan('initial');
})();