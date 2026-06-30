/* =========================================================
   EAP Word Quest • Teacher Identity Name Truth
   File: /herohealth/eap-word-quest/eap-word-teacher-v246-identity-name-truth.js
   Version: v2.4.6-TEACHER-IDENTITY-NAME-TRUTH-122

   A renamed learner must remain one person.
   - PROFILE markers supply the latest official student name.
   - Historical attempts are grouped by Group + Student ID, not a changing name.
   - PROFILE markers are excluded from score, progress, XP, attempts, and
     session analytics.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.6-TEACHER-IDENTITY-NAME-TRUTH-122";
  const GROUP = "122";

  if (window.__EAP_WORD_TEACHER_V246_IDENTITY_NAME_TRUTH__) return;
  window.__EAP_WORD_TEACHER_V246_IDENTITY_NAME_TRUTH__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const time = (value) => {
    const ms = new Date(value || 0).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };

  function isProfileMarker(record) {
    const id = norm(record && record.sessionId).toUpperCase();
    const type = norm(record && record.sessionType).toLowerCase();
    const source = norm(record && record.source).toLowerCase();
    return id === "PROFILE" || type === "profile" || source.indexOf("profile-identity-sync") >= 0;
  }

  function identityKey(record) {
    const group = norm(record && (record.group || record.section) || GROUP) || GROUP;
    const studentId = norm(record && record.studentId) || "anon";
    return `${group}|${studentId}`;
  }

  function canonicalize(logs) {
    const rows = Array.isArray(logs) ? logs : [];
    const names = new Map();

    rows.forEach((record) => {
      const key = identityKey(record);
      const candidate = norm(record && record.studentName);
      if (!candidate) return;
      const old = names.get(key);
      const candidateTime = time(record && (record.playedAt || record.clientTs));
      const oldTime = old ? old.time : -1;
      if (!old || candidateTime >= oldTime) {
        names.set(key, { name:candidate, time:candidateTime });
      }
    });

    const learningRows = rows
      .filter((record) => !isProfileMarker(record))
      .map((record) => {
        const copy = Object.assign({}, record);
        const key = identityKey(copy);
        const known = names.get(key);
        if (known && known.name) copy.studentName = known.name;
        copy.group = GROUP;
        copy.section = GROUP;
        copy.studentKey = key;
        return copy;
      });

    window.EAP_WORD_TEACHER_V246_STATE = {
      version: VERSION,
      sourceRows: rows.length,
      profileMarkers: rows.length - learningRows.length,
      learningRows: learningRows.length,
      identities: names.size,
      updatedAt: new Date().toISOString()
    };

    return learningRows;
  }

  function wrap() {
    const original = window.buildEapTeacherReport;
    if (typeof original !== "function" || original.__eapV246IdentityNameTruth) return false;

    const wrapped = function(inputLogs) {
      if (Array.isArray(inputLogs)) {
        return original.call(this, canonicalize(inputLogs));
      }

      const report = original.call(this);
      if (!report || !Array.isArray(report.logs)) return report;

      // Local mode is already compiled by the v241 Core-truth wrapper. Rebuild
      // only when a marker exists, so normal local ledger preservation remains.
      const hasMarker = report.logs.some(isProfileMarker);
      return hasMarker ? original.call(this, canonicalize(report.logs)) : report;
    };

    wrapped.__eapV246IdentityNameTruth = true;
    wrapped.__eapV246Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function wait(attempt) {
    if (wrap()) return;
    if (attempt >= 120) return;
    setTimeout(() => wait(attempt + 1), 25);
  }

  wait(0);
  window.inspectEapTeacherV246 = () => Object.assign({ version: VERSION }, window.EAP_WORD_TEACHER_V246_STATE || {});
})();
