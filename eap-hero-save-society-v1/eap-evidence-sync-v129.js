/* =========================================================
   EAP Hero Evidence Sync v129 (restored)
   Sends raw Writing/Speaking/Boss evidence to Apps Script.
========================================================= */
(function(){
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const SUBMISSION_KIND = 'fresh_evidence_v118';
  const SENT_KEY = 'EAP_HERO_RAW_EVIDENCE_SENT_V129';

  const clean = (value, limit) => String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit || 9000);

  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : (fallback || 0);

  function profile(state) {
    const p = (state && state.profile) || {};
    return {
      studentId: clean(p.studentId || p.id || 'guest', 80),
      studentName: clean(p.name || p.studentName || 'Guest', 160),
      section: clean(p.section || '122', 40)
    };
  }

  function sent() {
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); }
    catch (error) { return {}; }
  }

  function saveSent(map) {
    try { localStorage.setItem(SENT_KEY, JSON.stringify(map)); }
    catch (error) {}
  }

  function isBossSpeaking(entry) {
    const session = clean(entry && (entry.sessionId || entry.session), 40).toUpperCase();
    const skill = clean(entry && entry.skill, 80).toLowerCase();
    return /^(B[1-5]|BG[1-5])$/.test(session) && skill === 'speaking';
  }

  function evidenceId(entry, state) {
    const p = profile(state);
    return clean(
      entry.rawEvidenceId ||
      ('raw-' + p.studentId + '-' + clean(entry.sessionId || entry.session, 40) + '-' + clean(entry.skill, 80).replace(/[^a-z0-9_-]/gi, '') + '-' + Date.now()),
      220
    );
  }

  function post(payload) {
    try {
      fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload)
      }).catch(function(){});
      return true;
    } catch (error) {
      return false;
    }
  }

  function submitRaw(entry, state, extras) {
    if (!entry || !state) return false;
    extras = extras || {};

    const p = profile(state);
    const id = extras.evidenceId || evidenceId(entry, state);
    const bossReview = isBossSpeaking(entry);
    const payload = {
      action: 'submit_evidence',
      submissionKind: SUBMISSION_KIND,
      evidenceId: id,
      section: p.section,
      studentId: p.studentId,
      studentName: p.studentName,
      sessionId: clean(entry.sessionId || entry.session || '', 40),
      sessionTitle: clean(entry.sessionTitle || '', 240),
      skill: clean(entry.skill || '', 80),
      evidenceType: clean(entry.evidenceType || 'skill_evidence', 120),
      taskId: clean(entry.taskId || entry.abilityTaskId || '', 160),
      score: number(entry.score, 0),
      passed: Number(entry.score || 0) >= 60 || entry.passed === true,
      prompt: clean(entry.prompt || entry.instruction || entry.question || entry.sourceText || entry.passage || '', 6500),
      output: clean(extras.output || entry.output || entry.answer || entry.studentAnswer || entry.response || entry.transcript || '', 9000),
      durationSec: number(entry.durationSec || entry.speakingSeconds, 0),
      targetRange: clean(entry.targetRange || '', 160),
      teacherReviewRequired: bossReview,
      teacherReviewStatus: bossReview ? clean(extras.teacherReviewStatus || 'pending_teacher_review', 120) : '',
      oralChecklist: entry.oralChecklist || {},
      misconceptionTags: Array.isArray(entry.misconceptionTags) ? entry.misconceptionTags : [],
      boss: entry.boss || {},
      attemptCount: number(entry.attemptNo || entry.attemptCount, 1),
      occurredAt: clean(entry.at || new Date().toISOString(), 80),
      sourceUrl: location.href,
      consentAudio: !!extras.consentAudio
    };

    const history = sent();
    if (history[id]) return true;
    const ok = post(payload);
    if (ok) {
      history[id] = Date.now();
      saveSent(history);
    }
    return ok;
  }

  function captureSpeaking(entry, state) {
    const boss = isBossSpeaking(entry);
    const note = window.prompt(
      boss
        ? 'Boss Speaking: type a 1–2 sentence speaking note before continuing.'
        : 'Speaking note: type 1–2 sentences about what you said.'
    );
    if (note === null) return false;
    if (clean(note, 9000).split(/\s+/).filter(Boolean).length < 3) {
      alert('Please type a short speaking note before continuing.');
      return false;
    }
    return submitRaw(entry, state, {
      output: note,
      teacherReviewStatus: boss ? 'pending_teacher_review' : ''
    });
  }

  window.EAPEvidenceSyncV129 = {
    submitRaw: submitRaw,
    captureSpeaking: captureSpeaking,
    isBossSpeaking: isBossSpeaking
  };
})();