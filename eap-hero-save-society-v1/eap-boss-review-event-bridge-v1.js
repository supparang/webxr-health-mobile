/* =========================================================
   EAP Hero Boss Four-Skill Evidence Bridge v2
   - Records all B1–B5 Reading, Listening, Writing, and Speaking evidence
     through the deployed action='submit_event' receiver.
   - Only Boss Speaking is placed in the Teacher Review queue.
   - Retains learner output, duration, checklist, consent, and task prompt.
   - Never changes a game score, unlock, or language judgement.
========================================================= */
(function () {
  'use strict';

  var CFG = window.EAP_SHEET_CONFIG || {};
  var ENDPOINT = String(CFG.webAppUrl || '');
  var QUEUE_KEY = 'EAP_HERO_BOSS_REVIEW_EVENT_QUEUE_V2';
  var SENT_KEY = 'EAP_HERO_BOSS_SKILL_EVENT_SENT_V2';
  var BRIDGE_VERSION = 'boss-four-skill-event-v2';
  var patched = false;
  var BOSS_SKILLS = ['reading', 'listening', 'writing', 'speaking'];

  function safeText(value, limit) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit || 9000);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function profileFrom(state) {
    var profile = (state && (state.profile || state.player)) || {};
    return {
      studentId: safeText(profile.studentId || profile.id || (state && state.studentId) || 'guest', 80),
      studentName: safeText(profile.studentName || profile.name || (state && state.studentName) || 'Guest', 160),
      section: safeText(profile.section || (state && state.section) || CFG.section || '122', 40)
    };
  }

  function normalizedSession(entry) {
    return safeText(entry && (entry.sessionId || entry.session || ''), 40).toUpperCase();
  }

  function normalizedSkill(entry) {
    return safeText(entry && entry.skill, 80).toLowerCase();
  }

  function isBossSkill(entry) {
    return /^B[1-5]$/.test(normalizedSession(entry)) &&
      BOSS_SKILLS.indexOf(normalizedSkill(entry)) >= 0;
  }

  function requiresReview(entry) {
    return isBossSkill(entry) && normalizedSkill(entry) === 'speaking';
  }

  function evidenceId(entry, state) {
    var person = profileFrom(state);
    return safeText(
      entry.rawEvidenceId || entry.evidenceId ||
      ('boss-evidence-' + person.studentId + '-' + normalizedSession(entry) + '-' + normalizedSkill(entry) + '-' + Date.now()),
      220
    );
  }

  function buildEvent(entry, state, extras) {
    extras = extras || {};
    var person = profileFrom(state);
    var id = evidenceId(entry, state);
    var speaking = requiresReview(entry);
    var output = safeText(
      extras.output || entry.output || entry.answer || entry.studentAnswer || entry.transcript || entry.response || '',
      9000
    );

    return {
      action: 'submit_event',
      submissionKind: 'fresh_evidence_v118',
      bridgeVersion: BRIDGE_VERSION,
      eventId: id,
      eventType: speaking ? 'eap_boss_speaking_evidence' : 'eap_boss_skill_evidence',
      section: person.section,
      studentId: person.studentId,
      studentName: person.studentName,
      sessionId: normalizedSession(entry),
      skill: safeText(entry.skill, 80),
      value: {
        evidenceId: id,
        evidenceType: safeText(entry.evidenceType || ('boss_' + normalizedSkill(entry) + '_evidence'), 120),
        submissionKind: 'fresh_evidence_v118',
        section: person.section,
        studentId: person.studentId,
        studentName: person.studentName,
        sessionId: normalizedSession(entry),
        sessionTitle: safeText(entry.sessionTitle || '', 240),
        skill: safeText(entry.skill || '', 80),
        score: Number(entry.score || 0),
        passed: Number(entry.score || 0) >= 60,
        prompt: safeText(entry.prompt || entry.instruction || '', 6500),
        output: output,
        durationSec: Number(entry.durationSec || entry.speakingSeconds || 0),
        targetRange: safeText(entry.targetRange || '', 120),
        oralChecklist: entry.oralChecklist || {},
        boss: entry.boss || {},
        teacherReviewRequired: speaking,
        teacherReviewStatus: speaking
          ? safeText(extras.teacherReviewStatus || 'pending_teacher_review', 120)
          : '',
        consentAudio: speaking && !!extras.consentAudio,
        occurredAt: safeText(entry.at || new Date().toISOString(), 80),
        sourceUrl: location.href
      }
    };
  }

  function wasSent(id) {
    return !!readJson(SENT_KEY, {})[id];
  }

  function markSent(id) {
    var sent = readJson(SENT_KEY, {});
    sent[id] = { at: new Date().toISOString(), via: BRIDGE_VERSION };
    writeJson(SENT_KEY, sent);
  }

  function post(event) {
    if (!ENDPOINT || !event) return false;
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(event)
      }).catch(function () {});
      return true;
    } catch (_) { return false; }
  }

  function queueSpeaking(event) {
    var queue = readJson(QUEUE_KEY, {});
    if (!queue[event.eventId]) {
      queue[event.eventId] = {
        event: event,
        queuedAt: new Date().toISOString(),
        lastPostAt: '',
        posts: 0
      };
      writeJson(QUEUE_KEY, queue);
    }
    return queue[event.eventId];
  }

  function submitEvent(event, force) {
    if (!event || !event.eventId) return false;
    var speaking = event.value && event.value.teacherReviewRequired === true;
    if (speaking) queueSpeaking(event);
    if (!force && wasSent(event.eventId)) return true;

    var ok = post(event);
    if (ok) {
      markSent(event.eventId);
      if (speaking) {
        var queue = readJson(QUEUE_KEY, {});
        if (queue[event.eventId]) {
          queue[event.eventId].lastPostAt = new Date().toISOString();
          queue[event.eventId].posts = Number(queue[event.eventId].posts || 0) + 1;
          writeJson(QUEUE_KEY, queue);
        }
      }
    }
    return ok;
  }

  function replayQueuedSpeaking() {
    var queue = readJson(QUEUE_KEY, {});
    Object.keys(queue).forEach(function (id) {
      var item = queue[id];
      if (item && item.event && !wasSent(id)) submitEvent(item.event, false);
    });
  }

  function patchEvidenceSync() {
    var sync = window.EAPEvidenceSyncV130 || window.EAPEvidenceSyncV129;
    if (!sync || patched || typeof sync.submitRaw !== 'function') return false;

    var original = sync.submitRaw;
    sync.submitRaw = function (entry, state, extras) {
      if (isBossSkill(entry)) {
        submitEvent(buildEvent(entry, state, extras || {}), false);
      }
      return original.call(this, entry, state, extras);
    };

    sync.__bossFourSkillEventBridgeV2 = true;
    patched = true;
    return true;
  }

  function notice(message) {
    var old = document.getElementById('eap-boss-evidence-toast');
    if (old) old.remove();
    var node = document.createElement('div');
    node.id = 'eap-boss-evidence-toast';
    node.textContent = message;
    node.style.cssText = 'position:fixed;z-index:100050;right:18px;bottom:76px;max-width:min(420px,calc(100vw - 36px));padding:10px 12px;border-radius:12px;background:#17375e;color:#fff;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.24)';
    document.body.appendChild(node);
    setTimeout(function () { if (node.parentNode) node.remove(); }, 3400);
  }

  function installRetryButton() {
    if (document.getElementById('eap-boss-review-retry')) return;
    var button = document.createElement('button');
    button.id = 'eap-boss-review-retry';
    button.type = 'button';
    button.textContent = '📤 Retry Boss Speaking';
    button.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99998;border:0;border-radius:999px;padding:11px 14px;background:#0f766e;color:#fff;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.22);cursor:pointer';
    button.addEventListener('click', function () {
      var queue = readJson(QUEUE_KEY, {});
      var ids = Object.keys(queue);
      if (!ids.length) {
        notice('No saved Boss Speaking evidence is available to resend yet.');
        return;
      }
      ids.forEach(function (id) {
        var item = queue[id];
        if (item && item.event) submitEvent(item.event, true);
      });
      notice('Boss Speaking evidence was sent again for Teacher Review.');
    });
    document.body.appendChild(button);
  }

  function boot() {
    patchEvidenceSync();
    replayQueuedSpeaking();
    installRetryButton();
  }

  var timer = setInterval(function () {
    boot();
    if (patched) clearInterval(timer);
  }, 100);
  boot();

  window.EAPBossReviewEventBridgeV1 = {
    retry: function () {
      var queue = readJson(QUEUE_KEY, {});
      Object.keys(queue).forEach(function (id) {
        if (queue[id] && queue[id].event) submitEvent(queue[id].event, true);
      });
    },
    queue: function () { return readJson(QUEUE_KEY, {}); }
  };
})();
