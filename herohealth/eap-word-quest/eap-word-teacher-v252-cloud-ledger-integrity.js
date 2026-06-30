/* =========================================================
   EAP Word Quest • Confirmed Test Ledger Repair View
   File: /herohealth/eap-word-quest/eap-word-teacher-v252-cloud-ledger-integrity.js
   Version: v2.5.3-CONFIRMED-KK12-KP50-REPAIR-VIEW

   Confirmed test fact for Group 122:
   - KK / 12 completed the old 20-mission Core route.
   - KP / 50 completed one real mission.

   Legacy v243 records were written while KP's profile was active, so those
   20 historic rows were incorrectly labelled KP / 50. Do NOT hide them and
   leave the dashboard at zero. This read-only view reattributes only that
   exact, confirmed legacy test batch to KK / 12. A matching Apps Script
   repair persists the same correction in Sheets.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.5.3-CONFIRMED-KK12-KP50-REPAIR-VIEW";
  const GROUP = "122";
  const LEGACY_SOURCE = "core-state-backfill-v243";
  const FROM = { studentId:"50", studentName:"KP" };
  const TO = { studentId:"12", studentName:"KK" };
  const FLOW = new Set([
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);

  if (window.__EAP_WORD_TEACHER_V253_CONFIRMED_TEST_REPAIR__) return;
  window.__EAP_WORD_TEACHER_V253_CONFIRMED_TEST_REPAIR__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function isConfirmedMislabelledLegacy(row) {
    const section = norm(row && (row.section || row.group));
    const sessionId = norm(row && row.sessionId).toUpperCase();
    return norm(row && row.source).toLowerCase() === LEGACY_SOURCE &&
      norm(row && row.studentId) === FROM.studentId &&
      (!section || section === GROUP) &&
      FLOW.has(sessionId);
  }

  function repairedRows(input) {
    const state = { input:input.length, reassigned:0, preserved:0, sessions:[] };
    const rows = input.map((row) => {
      if (!isConfirmedMislabelledLegacy(row)) {
        state.preserved += 1;
        return row;
      }

      state.reassigned += 1;
      const sessionId = norm(row.sessionId).toUpperCase();
      if (state.sessions.indexOf(sessionId) < 0) state.sessions.push(sessionId);
      return Object.assign({}, row, {
        group: GROUP,
        section: GROUP,
        studentId: TO.studentId,
        studentName: TO.studentName,
        studentKey: `${GROUP}|${TO.studentId}|${TO.studentName}`,
        source: "teacher-confirmed-identity-repair-v253",
        identityRepair: "KK/12 confirmed owner of legacy v243 route; KP/50 remains separate"
      });
    });
    return { rows, state };
  }

  function install() {
    const original = window.buildEapTeacherReport;
    if (typeof original !== "function" || original.__eapV253ConfirmedTestRepair) return false;

    const wrapped = function(inputLogs) {
      // Explicit cloud / imported rows: apply the narrow, teacher-confirmed
      // identity repair. Local mode stays under the v251 strict-ID rule.
      if (!Array.isArray(inputLogs)) return original.call(this);

      const repaired = repairedRows(inputLogs.slice());
      const report = original.call(this, repaired.rows);
      window.EAP_WORD_TEACHER_V253_STATE = Object.assign({
        version: VERSION,
        from: FROM,
        to: TO,
        updatedAt: new Date().toISOString()
      }, repaired.state);
      return report;
    };

    wrapped.__eapV253ConfirmedTestRepair = true;
    wrapped.__eapV253Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function refreshCloudOnce() {
    const source = document.getElementById("sourcePill");
    const isCloud = /sheets|google/i.test(norm(source && source.textContent));
    const button = document.getElementById("loadCloudBtn");
    if (isCloud && button && typeof button.click === "function") button.click();
  }

  function wait(tries) {
    const ready = typeof window.buildEapTeacherReport === "function" &&
      (window.__EAP_WORD_TEACHER_V246_IDENTITY_NAME_TRUTH__ || tries > 160);
    if (ready && install()) {
      setTimeout(refreshCloudOnce, 180);
      return;
    }
    if (tries >= 260) return;
    setTimeout(() => wait(tries + 1), 30);
  }

  wait(0);
  window.inspectEapTeacherV253 = () => Object.assign({
    version: VERSION,
    from: FROM,
    to: TO
  }, window.EAP_WORD_TEACHER_V253_STATE || {});
})();
