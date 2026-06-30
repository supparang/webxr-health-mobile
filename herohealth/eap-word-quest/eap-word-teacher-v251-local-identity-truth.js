/* =========================================================
   EAP Word Quest • Local Identity Truth
   File: /herohealth/eap-word-quest/eap-word-teacher-v251-local-identity-truth.js
   Version: v2.5.1-LOCAL-IDENTITY-TRUTH-122

   Local dashboard rule:
   - Read raw saved learning rows directly.
   - Keep their original studentId/studentName exactly as stored.
   - When the current profile is KP / 50, show only KP / 50 local rows.
   - Never inject any other student's Core state into the current profile.
   - Google Sheets / CSV reports remain untouched.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.5.1-LOCAL-IDENTITY-TRUTH-122";
  const GROUP = "122";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";

  if (window.__EAP_WORD_TEACHER_V251_LOCAL_IDENTITY_TRUTH__) return;
  window.__EAP_WORD_TEACHER_V251_LOCAL_IDENTITY_TRUTH__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function currentProfile() {
    const profile = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    return {
      studentId: norm(profile.studentId || profile.id || ""),
      studentName: norm(profile.studentName || profile.name || "")
    };
  }

  function isLearningRow(row) {
    const sessionId = norm(row && (row.sessionId || row.session)).toUpperCase();
    const type = norm(row && row.sessionType).toLowerCase();
    const source = norm(row && row.source).toLowerCase();
    return Boolean(sessionId) &&
      sessionId !== "PROFILE" &&
      type !== "profile" &&
      !source.includes("profile-identity-sync");
  }

  function fingerprint(row) {
    return norm(row && row.fingerprint) || [
      norm(row && (row.group || row.section || GROUP)),
      norm(row && row.studentId),
      norm(row && row.sessionId),
      norm(row && (row.playedAt || row.endedAt || row.at)),
      norm(row && row.correct),
      norm(row && row.total),
      norm(row && row.source)
    ].join("|");
  }

  function trustedRowsForCurrentProfile() {
    const profile = currentProfile();
    if (!profile.studentId) return [];

    const raw = readJson(LOG_KEY, []);
    const seen = new Set();

    return (Array.isArray(raw) ? raw : [])
      .filter((row) => row && typeof row === "object")
      .filter(isLearningRow)
      .filter((row) => norm(row.studentId || row.id) === profile.studentId)
      .filter((row) => {
        const key = fingerprint(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((row) => Object.assign({}, row, {
        group: norm(row.group || row.section || GROUP) || GROUP,
        section: norm(row.section || row.group || GROUP) || GROUP,
        studentId: profile.studentId,
        studentName: norm(row.studentName || row.name) || profile.studentName || "Unknown",
        studentKey: `${GROUP}|${profile.studentId}|${norm(row.studentName || row.name) || profile.studentName || "Unknown"}`
      }));
  }

  function install() {
    const original = window.buildEapTeacherReport;
    if (typeof original !== "function" || original.__eapV251LocalIdentityTruth) return false;

    const wrapped = function(inputLogs) {
      // Cloud JSONP and imported CSV supply rows explicitly. Preserve them as-is.
      if (Array.isArray(inputLogs)) return original.call(this, inputLogs);
      // Local mode receives only real rows owned by the active profile.
      return original.call(this, trustedRowsForCurrentProfile());
    };

    wrapped.__eapV251LocalIdentityTruth = true;
    wrapped.__eapV251Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function refreshLocalOnce() {
    const sourcePill = document.getElementById("sourcePill");
    const local = /local/i.test(norm(sourcePill && sourcePill.textContent));
    const button = document.getElementById("useLocalBtn");
    if (local && button && typeof button.click === "function") button.click();
  }

  function wait(tries) {
    if (install()) {
      setTimeout(refreshLocalOnce, 120);
      return;
    }
    if (tries >= 240) return;
    setTimeout(() => wait(tries + 1), 25);
  }

  wait(0);
  window.inspectEapTeacherV251 = () => ({
    version: VERSION,
    profile: currentProfile(),
    trustedRows: trustedRowsForCurrentProfile().length,
    installed: Boolean(window.buildEapTeacherReport && window.buildEapTeacherReport.__eapV251LocalIdentityTruth)
  });
})();
