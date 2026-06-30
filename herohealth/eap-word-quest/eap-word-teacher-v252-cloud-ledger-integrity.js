/* =========================================================
   EAP Word Quest • Cloud Ledger Integrity Filter
   File: /herohealth/eap-word-quest/eap-word-teacher-v252-cloud-ledger-integrity.js
   Version: v2.5.2-CLOUD-LEDGER-INTEGRITY-122

   Why
   A legacy browser-only Core-history backfill (v243) could label an old
   profile's route with whichever Student ID was active when the shared
   browser was opened. Those rows have no durable original-identity proof.

   Teacher rule
   - Completed live Core attempts are official cloud evidence.
   - PROFILE markers remain excluded by the existing v246 layer.
   - v243 legacy backfill rows are quarantined from the teacher calculation.
   - The cloud sheet is not changed here; this is a read-only integrity guard.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.5.2-CLOUD-LEDGER-INTEGRITY-122";
  const LEGACY_SOURCE = "core-state-backfill-v243";

  if (window.__EAP_WORD_TEACHER_V252_CLOUD_LEDGER_INTEGRITY__) return;
  window.__EAP_WORD_TEACHER_V252_CLOUD_LEDGER_INTEGRITY__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function isUnsafeLegacyBackfill(row) {
    return norm(row && row.source).toLowerCase() === LEGACY_SOURCE;
  }

  function install() {
    const original = window.buildEapTeacherReport;
    if (typeof original !== "function" || original.__eapV252CloudLedgerIntegrity) return false;

    const wrapped = function(inputLogs) {
      // Only cloud / CSV reports provide an explicit ledger. Local mode keeps
      // the strict current-profile path created by v251.
      if (!Array.isArray(inputLogs)) return original.call(this);

      const rows = inputLogs.slice();
      const quarantined = rows.filter(isUnsafeLegacyBackfill);
      const trusted = rows.filter((row) => !isUnsafeLegacyBackfill(row));
      const report = original.call(this, trusted);

      window.EAP_WORD_TEACHER_V252_STATE = {
        version: VERSION,
        inputRows: rows.length,
        trustedRows: trusted.length,
        quarantinedLegacyRows: quarantined.length,
        quarantinedIdentities: Array.from(new Set(quarantined.map((row) => `${norm(row.studentName)} / ${norm(row.studentId)}`))).filter(Boolean),
        updatedAt: new Date().toISOString()
      };

      return report;
    };

    wrapped.__eapV252CloudLedgerIntegrity = true;
    wrapped.__eapV252Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function refreshCloudOnce() {
    const source = document.getElementById("sourcePill");
    const inCloudMode = /sheets|google/i.test(norm(source && source.textContent));
    const button = document.getElementById("loadCloudBtn");
    if (inCloudMode && button && typeof button.click === "function") button.click();
  }

  function wait(tries) {
    // Wait for v241/v246/v251 wrapper chain first. v242 loads that chain after
    // teacher.html renders, so the final filter must install last.
    const ready = typeof window.buildEapTeacherReport === "function" &&
      (window.__EAP_WORD_TEACHER_V246_IDENTITY_NAME_TRUTH__ || window.__EAP_WORD_TEACHER_V251_LOCAL_IDENTITY_TRUTH__ || tries > 160);
    if (ready && install()) {
      setTimeout(refreshCloudOnce, 180);
      return;
    }
    if (tries >= 260) return;
    setTimeout(() => wait(tries + 1), 30);
  }

  wait(0);
  window.inspectEapTeacherV252 = () => Object.assign({ version: VERSION }, window.EAP_WORD_TEACHER_V252_STATE || {});
})();
