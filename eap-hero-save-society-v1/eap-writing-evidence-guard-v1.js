/* =========================================================
   EAP Hero Writing Evidence Guard v2
   File: eap-writing-evidence-guard-v1.js

   Purpose
   - Keeps valid learner writing in the normal game flow.
   - Sends normal-session Writing evidence to eap_hero_evidence.
   - Lets the Apps Script Contract classify it as Mastery or Exposure.
   - Does not alter game score, unlocks, or teacher-review rules.
========================================================= */
(function(){
  'use strict';

  var STORE = 'EAP_HERO_PROGRESS_V3';
  var SENT = 'EAP_HERO_WRITING_EVIDENCE_SENT_V2';
  var heroPatched = false;

  function clean(v) {
    return String(v == null ? '' : v)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pageText() {
    return String(
      (document.getElementById('app') || document.body)
        .innerText || ''
    );
  }

  function currentSession() {
    var match = pageText().match(
      /(?:Session\s*|\bS)(1[0-5]|[1-9])\b/i
    );

    return Number(match && match[1] || 0);
  }

  function writingPage() {
    return /Writing Mission|Writing Evidence Saved/i
      .test(pageText());
  }

  function box() {
    return document.getElementById('writingOutput');
  }

  function acceptable(value) {
    return clean(value)
      .split(/\s+/)
      .filter(Boolean)
      .length >= 4;
  }

  function readState() {
    try {
      return JSON.parse(
        localStorage.getItem(STORE) || 'null'
      );
    } catch (error) {
      return null;
    }
  }

  function sentMap() {
    try {
      return JSON.parse(
        localStorage.getItem(SENT) || '{}'
      );
    } catch (error) {
      return {};
    }
  }

  function saveSent(map) {
    try {
      localStorage.setItem(SENT, JSON.stringify(map));
    } catch (error) {}
  }

  function visibleScore() {
    var match = pageText().match(
      /(?:Auto Score|Writing Evidence Saved)[\s\S]{0,180}?(\d{1,3})\s*\/\s*100/i
    );

    if (!match) {
      match = pageText().match(/\b(\d{1,3})\s*\/\s*100\b/);
    }

    var score = Number(match && match[1]);

    return Number.isFinite(score)
      ? Math.max(0, Math.min(100, score))
      : 0;
  }

  function titleFor(sessionNumber) {
    var titles = {
      1: 'Academic Hero Awakening',
      2: 'Vocabulary Lab',
      3: 'Main Idea Hunter',
      4: 'Keyword Scanner',
      5: 'Critical Reading',
      6: 'Summary Builder',
      7: 'Academic Tone Battle',
      8: 'Paragraph Structure Lab',
      9: 'Paragraph Writing',
      10: 'Data Description',
      11: 'Academic Email',
      12: 'Citation and Ethics',
      13: 'Academic Listening',
      14: 'Academic Presentation',
      15: 'Final Integration'
    };

    return titles[sessionNumber] ||
      ('Session ' + sessionNumber);
  }

  function promptFor() {
    var node = document.querySelector(
      '[data-writing-prompt], .writing-prompt, .mission-prompt, .prompt'
    );

    return clean(node && node.innerText) ||
      'Writing activity evidence.';
  }

  function submitWritingEvidence(value, sessionNumber) {
    if (!acceptable(value) || !sessionNumber) {
      return false;
    }

    var sync =
      window.EAPEvidenceSyncV131 ||
      window.EAPEvidenceSyncV130 ||
      window.EAPEvidenceSyncV129;

    if (!sync || typeof sync.submitRaw !== 'function') {
      console.warn(
        '[EAP Writing Evidence Guard v2] Evidence Sync is unavailable'
      );
      return false;
    }

    var state = readState();

    if (!state || !state.profile) {
      console.warn(
        '[EAP Writing Evidence Guard v2] Player profile is unavailable'
      );
      return false;
    }

    var profile = state.profile || {};
    var studentId = clean(
      profile.studentId || profile.id || 'guest'
    );

    var dedupeKey = [
      studentId,
      'S' + sessionNumber,
      clean(value).slice(0, 120)
    ].join('|');

    var sent = sentMap();

    if (sent[dedupeKey]) {
      return true;
    }

    var entry = {
      rawEvidenceId:
        'writing-' +
        studentId +
        '-S' +
        sessionNumber +
        '-' +
        Date.now(),

      sessionId: 'S' + sessionNumber,
      sessionTitle: titleFor(sessionNumber),

      skill: 'writing',
      evidenceType: 'writing_evidence',
      taskId: 'writing_s' + sessionNumber,

      score: visibleScore(),

      prompt: promptFor(),

      output: value,
      answer: value,
      studentAnswer: value,

      attemptNo: 1,
      at: new Date().toISOString()
    };

    var ok = sync.submitRaw(entry, state, {
      output: value
    });

    if (ok) {
      sent[dedupeKey] = Date.now();
      saveSent(sent);

      console.info(
        '[EAP Writing Evidence Guard v2] submitted',
        entry.rawEvidenceId
      );
    }

    return ok;
  }

  function patchHero() {
    var api = window.EAPHero;

    if (
      !api ||
      heroPatched ||
      typeof api.submitWriting !== 'function'
    ) {
      return;
    }

    var original = api.submitWriting.bind(api);

    api.submitWriting = function() {
      var sessionNumber = currentSession();
      var value = clean(box() && box().value);

      if (writingPage() && !acceptable(value)) {
        alert(
          'กรุณาเขียนคำตอบของตนเองอย่างน้อย 1 ประโยคก่อนส่ง'
        );

        if (box()) {
          box().focus();
        }

        return false;
      }

      var result = original.apply(api, arguments);

      if (acceptable(value) && sessionNumber) {
        window.setTimeout(function() {
          submitWritingEvidence(value, sessionNumber);
        }, 350);

        window.setTimeout(function() {
          submitWritingEvidence(value, sessionNumber);
        }, 1200);
      }

      return result;
    };

    heroPatched = true;
  }

  var timer = window.setInterval(function() {
    patchHero();

    if (heroPatched) {
      window.clearInterval(timer);
    }
  }, 120);

  window.EAPWritingEvidenceGuardV2 = {
    submitWritingEvidence: submitWritingEvidence,
    currentSession: currentSession
  };
})();
