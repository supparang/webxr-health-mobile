/* =========================================================
   EAP Word Quest • Local Ledger Truth
   File: /herohealth/eap-word-quest/eap-word-teacher-v249-local-ledger-truth.js
   Version: v2.4.9-LOCAL-LEDGER-TRUTH-122

   Local dashboard source-of-truth rule:
   Use only log rows that already carry the same Student ID as the saved
   current profile. Do not infer ownership from the current profile, legacy
   stats cache, or a Core state key.

   This keeps KK / 12 and KP / 50 completely separate on a shared browser.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.9-LOCAL-LEDGER-TRUTH-122";
  const GROUP = "122";

  if (window.__EAP_WORD_TEACHER_V249_LOCAL_LEDGER_TRUTH__) return;
  window.__EAP_WORD_TEACHER_V249_LOCAL_LEDGER_TRUTH__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function currentProfile() {
    try {
      const raw = localStorage.getItem("EAP_WORD_QUEST_PROFILE_V01");
      const profile = raw ? JSON.parse(raw) : {};
      return {
        studentId: norm(profile.studentId || profile.id || ""),
        studentName: norm(profile.studentName || profile.name || "")
      };
    } catch (err) {
      return { studentId:"", studentName:"" };
    }
  }

  function trustedLocalRows() {
    const profile = currentProfile();
    const logs = typeof window.readEapWordQuestLogs === "function"
      ? window.readEapWordQuestLogs()
      : [];

    const seen = new Set();
    return (Array.isArray(logs) ? logs : [])
      .filter((record) => norm(record && record.studentId) === profile.studentId)
      .filter((record) => {
        const sessionId = norm(record && record.sessionId).toUpperCase();
        const type = norm(record && record.sessionType).toLowerCase();
        const source = norm(record && record.source).toLowerCase();
        return sessionId && sessionId !== "PROFILE" && type !== "profile" && !source.includes("profile-identity-sync");
      })
      .filter((record) => {
        const key = norm(record.fingerprint) || [
          norm(record.studentId), norm(record.sessionId), norm(record.playedAt),
          norm(record.correct), norm(record.total), norm(record.source)
        ].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((record) => Object.assign({}, record, {
        group: GROUP,
        section: GROUP,
        studentId: profile.studentId,
        studentName: norm(record.studentName) || profile.studentName || "Unknown",
        studentKey: `${GROUP}|${profile.studentId}|${norm(record.studentName) || profile.studentName || "Unknown"}`
      }));
  }

  function install() {
    const original = window.buildEapTeacherReport;
    if (typeof original !== "function" || original.__eapV249LocalLedgerTruth) return false;

    const wrapped = function(inputLogs) {
      // An explicit array comes from Google Sheets / CSV and remains untouched.
      if (Array.isArray(inputLogs)) return original.call(this, inputLogs);
      return original.call(this, trustedLocalRows());
    };

    wrapped.__eapV249LocalLedgerTruth = true;
    wrapped.__eapV249Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function refreshLocalOnceInstalled() {
    const pill = document.getElementById("sourcePill");
    const localView = /local/i.test(norm(pill && pill.textContent));
    const button = document.getElementById("useLocalBtn");
    if (localView && button && typeof button.click === "function") button.click();
  }

  function wait(tries) {
    if (install()) {
      setTimeout(refreshLocalOnceInstalled, 80);
      return;
    }
    if (tries >= 240) return;
    setTimeout(() => wait(tries + 1), 25);
  }

  wait(0);
  window.inspectEapTeacherV249 = () => ({
    version: VERSION,
    profile: currentProfile(),
    trustedLocalRows: trustedLocalRows().length,
    installed: Boolean(window.buildEapTeacherReport && window.buildEapTeacherReport.__eapV249LocalLedgerTruth)
  });
})();
