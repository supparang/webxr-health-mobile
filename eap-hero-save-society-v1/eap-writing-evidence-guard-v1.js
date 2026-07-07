/* =========================================================
   EAP Hero Writing Evidence Guard v4
   File: eap-writing-evidence-guard-v1.js

   Reliable normal Writing evidence transport
   ---------------------------------------------------------
   - Observes NEW Writing records in EAP_HERO_PROGRESS_V3.portfolio.
   - Does not depend on a particular button label or EAPHero method.
   - Posts submit_evidence through a hidden form to the existing
     Google Apps Script Web App.
   - Contract V2 decides Mastery vs Exposure at the receiver.
========================================================= */
(function(){
  'use strict';

  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var SENT_KEY = 'EAP_HERO_WRITING_EVIDENCE_SENT_V4';
  var FRAME_ID = 'eap-writing-evidence-v4-receiver';

  var WEB_APP_URL =
    (window.EAP_SHEET_CONFIG || {}).webAppUrl ||
    'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';

  var SUBMISSION_KIND = 'fresh_evidence_v118';
  var known = {};
  var timer = null;

  function text(value) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function getState() {
    return readJson(STATE_KEY, {});
  }

  function getProfile(state) {
    var direct = readJson(PROFILE_KEY, {});
    var fromState =
      (state && (
        state.profile ||
        state.player ||
        state.user
      )) || {};

    var source = Object.keys(direct).length
      ? direct
      : fromState;

    var studentId = text(
      source.studentId ||
      source.id ||
      (state && state.studentId)
    );

    var studentName = text(
      source.studentName ||
      source.name ||
      (state && (
        state.studentName ||
        state.name ||
        state.playerName
      ))
    );

    var section = text(
      source.section ||
      (state && state.section) ||
      '122'
    ) || '122';

    if (!studentId || studentId.toLowerCase() === 'guest') {
      return null;
    }

    return {
      studentId: studentId,
      studentName: studentName || 'Unknown',
      section: section
    };
  }

  function sessionId(entry) {
    var raw = text(
      entry && (
        entry.sessionId ||
        entry.session ||
        entry.sessionNumber ||
        entry.sessionCode
      )
    ).toUpperCase();

    var match = raw.match(
      /(?:^|\b)S(?:ESSION)?\s*0?([1-9]|1[0-5])(?:\b|_)/
    );

    if (match) {
      return 'S' + Number(match[1]);
    }

    if (/^0?([1-9]|1[0-5])$/.test(raw)) {
      return 'S' + Number(raw);
    }

    return '';
  }

  function isWriting(entry) {
    return /writing|write/i.test(text(
      entry && (
        entry.skill ||
        entry.skillName ||
        entry.evidenceType ||
        entry.taskId ||
        entry.type
      )
    ));
  }

  function output(entry) {
    var fields = [
      entry && entry.output,
      entry && entry.answer,
      entry && entry.studentAnswer,
      entry && entry.writtenResponse,
      entry && entry.response,
      entry && entry.text,
      entry && entry.value
    ];

    for (var index = 0; index < fields.length; index += 1) {
      var result = text(fields[index]);
      if (result) {
        return result;
      }
    }

    return '';
  }

  function score(entry) {
    var fields = [
      entry && entry.latestScore,
      entry && entry.score,
      entry && entry.bestScore
    ];

    for (var index = 0; index < fields.length; index += 1) {
      var result = Number(fields[index]);

      if (Number.isFinite(result)) {
        return Math.max(0, Math.min(100, result));
      }
    }

    return 0;
  }

  function occurredAt(entry, index) {
    return text(
      entry && (
        entry.occurredAt ||
        entry.at ||
        entry.createdAt ||
        entry.submittedAt ||
        entry.latestAt ||
        entry.timestamp ||
        entry.evidenceId
      )
    ) || String(index);
  }

  function signature(entry, index) {
    return [
      sessionId(entry),
      text(entry && entry.skill).toLowerCase(),
      occurredAt(entry, index),
      score(entry),
      output(entry).slice(0, 260)
    ].join('|');
  }

  function titleFor(sid) {
    var titles = {
      S1: 'Academic Hero Awakening',
      S2: 'Vocabulary Lab',
      S3: 'Main Idea Hunter',
      S4: 'Keyword Scanner',
      S5: 'Critical Reading',
      S6: 'Summary Builder',
      S7: 'Academic Tone Battle',
      S8: 'Paragraph Structure Lab',
      S9: 'Paragraph Writing',
      S10: 'Data Description',
      S11: 'Academic Email',
      S12: 'Citation and Ethics',
      S13: 'Academic Listening',
      S14: 'Academic Presentation',
      S15: 'Final Integration'
    };

    return titles[sid] || sid;
  }

  function ensureFrame() {
    var frame = document.getElementById(FRAME_ID);

    if (frame) {
      return frame;
    }

    frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.name = FRAME_ID;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'display:none!important;width:1px;height:1px;border:0';

    document.documentElement.appendChild(frame);

    return frame;
  }

  function scalar(value) {
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return '';
      }
    }

    return String(value == null ? '' : value);
  }

  function postEvidence(payload) {
    try {
      ensureFrame();

      var form = document.createElement('form');
      form.method = 'POST';
      form.action = WEB_APP_URL;
      form.target = FRAME_ID;
      form.style.display = 'none';

      Object.keys(payload).forEach(function(key) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = scalar(payload[key]);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      window.setTimeout(function() {
        try {
          form.remove();
        } catch (error) {}
      }, 0);

      return true;
    } catch (error) {
      console.warn(
        '[EAP Writing Evidence Guard v4] POST failed',
        error
      );

      return false;
    }
  }

  function toast(message) {
    var old = document.getElementById(
      'eap-writing-evidence-v4-toast'
    );

    if (old) {
      old.remove();
    }

    var node = document.createElement('div');
    node.id = 'eap-writing-evidence-v4-toast';
    node.textContent = message;

    node.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:76px',
      'z-index:100002',
      'padding:10px 13px',
      'border-radius:12px',
      'background:#065f46',
      'color:#fff',
      'font:800 13px system-ui,-apple-system,sans-serif',
      'box-shadow:0 10px 28px rgba(0,0,0,.24)'
    ].join(';');

    document.body.appendChild(node);

    window.setTimeout(function() {
      if (node.parentNode) {
        node.remove();
      }
    }, 4200);
  }

  function send(entry, state, index) {
    var person = getProfile(state);

    if (!person) {
      console.warn(
        '[EAP Writing Evidence Guard v4] valid profile unavailable'
      );

      return false;
    }

    var sid = sessionId(entry);
    var answer = output(entry);

    if (!sid || !answer) {
      return false;
    }

    var sent = readJson(SENT_KEY, {});
    var key = signature(entry, index);

    if (sent[key]) {
      return true;
    }

    var evidenceId = [
      'writing',
      person.studentId,
      sid,
      Date.now()
    ].join('-');

    var payload = {
      action: 'submit_evidence',
      submissionKind: SUBMISSION_KIND,
      evidenceId: evidenceId,

      section: person.section,
      studentId: person.studentId,
      studentName: person.studentName,

      sessionId: sid,
      sessionTitle:
        text(entry.sessionTitle) || titleFor(sid),

      skill: 'writing',
      evidenceType: 'writing_evidence',
      taskId:
        text(entry.taskId) ||
        ('writing_' + sid.toLowerCase()),

      score: score(entry),
      passed: score(entry) >= 60 ? 'TRUE' : 'FALSE',

      prompt: text(
        entry.prompt ||
        entry.instruction ||
        entry.question
      ) || 'Writing activity evidence.',

      output: answer,

      durationSec: 0,
      targetRange: '',

      teacherReviewRequired: 'FALSE',
      teacherReviewStatus: '',

      oralChecklist: '{}',
      misconceptionTags: '[]',
      boss: '{}',

      attemptCount: Number(
        entry.attemptNo ||
        entry.attemptCount ||
        1
      ),

      occurredAt:
        occurredAt(entry, index) ||
        new Date().toISOString(),

      sourceUrl: location.href,
      consentAudio: 'FALSE'
    };

    if (!postEvidence(payload)) {
      return false;
    }

    sent[key] = {
      evidenceId: evidenceId,
      submittedAt: Date.now()
    };

    writeJson(SENT_KEY, sent);

    toast('📝 ส่งหลักฐาน Writing เข้า Sheet แล้ว');
    console.info(
      '[EAP Writing Evidence Guard v4] sent',
      payload
    );

    return true;
  }

  function prime() {
    var state = getState();
    var portfolio = Array.isArray(state.portfolio)
      ? state.portfolio
      : [];

    portfolio.forEach(function(entry, index) {
      known[signature(entry, index)] = true;
    });
  }

  function scan() {
    var state = getState();
    var portfolio = Array.isArray(state.portfolio)
      ? state.portfolio
      : [];

    portfolio.forEach(function(entry, index) {
      var key = signature(entry, index);

      if (known[key]) {
        return;
      }

      known[key] = true;

      if (
        isWriting(entry) &&
        sessionId(entry) &&
        output(entry)
      ) {
        send(entry, state, index);
      }
    });
  }

  function boot() {
    prime();

    timer = window.setInterval(scan, 500);

    window.addEventListener('beforeunload', scan);
  }

  window.EAPWritingEvidenceGuardV4 = {
    scan: scan,

    inspect: function() {
      var state = getState();

      return Array.isArray(state.portfolio)
        ? state.portfolio
        : [];
    }
  };

  boot();
})();
