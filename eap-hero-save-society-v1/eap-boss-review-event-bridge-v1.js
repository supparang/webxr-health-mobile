/* =========================================================
   EAP Hero Boss Review Event Bridge v1
   Purpose
   - The deployed EAP receiver already accepts action='submit_event'.
   - Older Evidence Sync posted action='submit_evidence', which the v4
     shared router did not route, leaving the Teacher Review queue empty.
   - This bridge queues only B1–B5 Speaking evidence and posts a
     compatible, idempotent event without changing scores or unlocks.
   - The event preserves the learner's actual speaking note, duration,
     checklist, and consent flag. It never grades language automatically.
========================================================= */
(function () {
  'use strict';

  var CFG = window.EAP_SHEET_CONFIG || {};
  var ENDPOINT = String(CFG.webAppUrl || '');
  var QUEUE_KEY = 'EAP_HERO_BOSS_REVIEW_EVENT_QUEUE_V1';
  var SENT_KEY = 'EAP_HERO_BOSS_REVIEW_EVENT_SENT_V1';
  var BRIDGE_VERSION = 'boss-review-event-v1';
  var patched = false;

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
    } catch (_) {
      return fallback;
    }
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

  function isBossSpeaking(entry) {
    var session = safeText(entry && (entry.sessionId || entry.session || '')).toUpperCase();
    var skill = safeText(entry && entry.skill).toLowerCase();
    return /^B[1-5]$/.test(session) && skill === 'speaking';
  }

  function evidenceId(entry, state) {
    var person = profileFrom(state);
    return safeText(
      entry.rawEvidenceId || entry.evidenceId ||
      ('boss-review-' + person.studentId + '-' + safeText(entry.sessionId || entry.session, 20) + '-' + Date.now()),
      220
    );
  }

  function buildEvent(entry, state, extras) {
    extras = extras || {};
    var person = profileFrom(state);
    var id = evidenceId(entry, state);
    var output = safeText(
      extras.output || entry.output || entry.answer || entry.studentAnswer || entry.transcript || entry.response || '',
      9000
    );

    return {
      action: 'submit_event',
      submissionKind: 'fresh_evidence_v118',
      bridgeVersion: BRIDGE_VERSION,
      eventId: id,
      eventType: 'eap_boss_speaking_evidence',
      section: person.section,
      studentId: person.studentId,
      studentName: person.studentName,
      sessionId: safeText(entry.sessionId || entry.session || '', 40).toUpperCase(),
      skill: 'Speaking',
      value: {
        evidenceId: id,
        evidenceType: safeText(entry.evidenceType || 'boss_speaking_evidence', 120),
        submissionKind: 'fresh_evidence_v118',
        section: person.section,
        studentId: person.studentId,
        studentName: person.studentName,
        sessionId: safeText(entry.sessionId || entry.session || '', 40).toUpperCase(),
        sessionTitle: safeText(entry.sessionTitle || '', 240),
        skill: 'Speaking',
        score: Number(entry.score || 0),
        passed: Number(entry.score || 0) >= 60,
        prompt: safeText(entry.prompt || entry.instruction || '', 6500),
        output: output,
        durationSec: Number(entry.durationSec || entry.speakingSeconds || 0),
        targetRange: safeText(entry.targetRange || '', 120),
        oralChecklist: entry.oralChecklist || {},
        boss: entry.boss || {},
        teacherReviewRequired: true,
        teacherReviewStatus: safeText(extras.teacherReviewStatus || 'pending_teacher_review', 120),
        consentAudio: !!extras.consentAudio,
        occurredAt: safeText(entry.at || new Date().toISOString(), 80),
        sourceUrl: location.href
      }
    };
  }

  function queueEvent(event) {
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
    } catch (_) {
      return false;
    }
  }

  function submitEvent(event, force) {
    if (!event || !event.eventId) return false;
    queueEvent(event);
    if (!force && wasSent(event.eventId)) return true;
    var ok = post(event);
    if (ok) {
      markSent(event.eventId);
      var queue = readJson(QUEUE_KEY, {});
      if (queue[event.eventId]) {
        queue[event.eventId].lastPostAt = new Date().toISOString();
        queue[event.eventId].posts = Number(queue[event.eventId].posts || 0) + 1;
        writeJson(QUEUE_KEY, queue);
      }
    }
    return ok;
  }

  function replayQueuedEvidence() {
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
      if (isBossSpeaking(entry)) {
        submitEvent(buildEvent(entry, state, extras || {}), false);
      }
      return original.call(this, entry, state, extras);
    };

    sync.__bossReviewEventBridgeV1 = true;
    patched = true;
    return true;
  }

  function notice(message) {
    var old = document.getElementById('eap-boss-review-event-toast');
    if (old) old.remove();
    var node = document.createElement('div');
    node.id = 'eap-boss-review-event-toast';
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
    button.textContent = '📤 Retry Boss Evidence';
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
      notice('Boss Speaking evidence was sent again to the Teacher Review queue.');
    });
    document.body.appendChild(button);
  }

  function boot() {
    patchEvidenceSync();
    replayQueuedEvidence();
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
