/* =========================================================
   EAP Hero Raw Evidence Sync v128
   Sends the uncompressed evidence only when addPortfolio() creates it.
   No portfolio scan, no replay/backfill, no score submission.
========================================================= */
(function(){
  'use strict';

  const WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';

  const SUBMISSION_KIND = 'fresh_evidence_v118';
  const SENT_KEY = 'EAP_HERO_RAW_EVIDENCE_SENT_V128';

  function safeText(value, limit){
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit || 6000);
  }

  function number(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function readSent(){
    try{
      return JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
    }catch(err){
      return {};
    }
  }

  function saveSent(sent){
    try{
      localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    }catch(err){}
  }

  function profileFrom(state){
    const p = (state && state.profile) || {};
    return {
      studentId: safeText(p.studentId || p.id || 'guest', 80),
      studentName: safeText(p.name || p.studentName || 'Guest', 160),
      section: safeText(p.section || '122', 40)
    };
  }

  function send(payload){
    const body = JSON.stringify(payload);

    try{
      if(navigator.sendBeacon){
        const ok = navigator.sendBeacon(
          WEB_APP_URL,
          new Blob([body], {type:'text/plain;charset=UTF-8'})
        );
        if(ok) return true;
      }
    }catch(err){}

    try{
      fetch(WEB_APP_URL, {
        method:'POST',
        mode:'no-cors',
        keepalive:true,
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:body
      }).catch(function(){});
      return true;
    }catch(err){
      return false;
    }
  }

  function submitRaw(entry, state){
    if(!entry || !state) return false;

    const person = profileFrom(state);
    const sessionId = safeText(entry.sessionId || entry.session || state.currentSession || '', 40);
    const skill = safeText(entry.skill || '', 80);

    if(!person.studentId || !sessionId || !skill) return false;

    const stamp = safeText(entry.at || new Date().toISOString(), 80);
    const evidenceId = safeText(
      entry.rawEvidenceId ||
      ('raw-' + person.studentId + '-' + sessionId + '-' +
       skill.replace(/[^a-z0-9_-]/gi, '') + '-' + Date.now()),
      180
    );

    const sent = readSent();
    if(sent[evidenceId]) return true;

    const payload = {
      action:'submit_evidence',
      submissionKind:SUBMISSION_KIND,
      evidenceId:evidenceId,

      section:person.section,
      studentId:person.studentId,
      studentName:person.studentName,

      sessionId:sessionId,
      sessionTitle:safeText(entry.sessionTitle || '', 240),
      skill:skill,

      evidenceType:safeText(entry.evidenceType || 'skill_evidence', 120),
      taskId:safeText(entry.taskId || entry.abilityTaskId || '', 160),

      score:number(entry.score, 0),
      passed:number(entry.score, 0) >= 60,

      prompt:safeText(
        entry.prompt || entry.instruction || entry.passage ||
        entry.question || entry.sourceText || '',
        6000
      ),

      output:safeText(
        entry.output || entry.answer || entry.studentAnswer ||
        entry.transcript || entry.response || '',
        8000
      ),

      durationSec:number(entry.durationSec || entry.speakingSeconds, 0),
      targetRange:safeText(entry.targetRange || '', 160),

      teacherReviewRequired:!!entry.teacherReviewRequired,
      teacherReviewStatus:safeText(entry.teacherReviewStatus || '', 80),
      oralChecklist:entry.oralChecklist || {},
      misconceptionTags:Array.isArray(entry.misconceptionTags)
        ? entry.misconceptionTags
        : [],

      boss:entry.boss || {},
      attemptCount:number(entry.attemptNo || entry.attemptCount, 1),
      occurredAt:stamp,
      sourceUrl:location.href
    };

    const accepted = send(payload);
    if(accepted){
      sent[evidenceId] = Date.now();
      saveSent(sent);
    }
    return accepted;
  }

  window.EAPEvidenceSyncV128 = {
    submitRaw: submitRaw
  };
})();