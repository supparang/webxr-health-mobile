/* =========================================================
   CSAI2102 AI Quest
   Teacher Console Runtime v5.0.0
   ---------------------------------------------------------
   Loads AR analytics and the curriculum-aligned Core Evidence Audit.
   The audit treats old Knowledge S6/B2 results as historical evidence,
   not as certification of the revised Minimax curriculum.
========================================================= */
(() => {
  "use strict";
  const VERSION = "v5.0.0-teacher-console-minimax-audit";

  function isTeacherOnlyPage() {
    return !!window.AIQUEST_FORCE_TEACHER_PAGE ||
      !!window.AIQUEST_TEACHER_ONLY_PAGE ||
      /\/teacher\.html$/i.test(location.pathname);
  }

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function loadArAnalytics() {
    if (!isTeacherOnlyPage()) return;
    loadScript("aiquestTeacherS1ArAnalyticsV371", "./js/aiquest-teacher-s1-ar-analytics-v371.js?v=20260625-teacherclean371");
  }

  function loadMinimaxCoreAudit() {
    if (!isTeacherOnlyPage()) return;
    const oldCard = document.getElementById("coreAuditV411");
    if (oldCard) oldCard.remove();
    const oldScript = document.getElementById("aiquestCoreAuditV411Script");
    if (oldScript) oldScript.remove();
    loadScript("aiquestCoreAuditV500Script", "./js/aiquest-teacher-core-audit-v411.js?v=20260704-minimax500");
  }

  function patchTeacherLabels() {
    const sub = document.querySelector(".top .sub");
    if (sub) sub.textContent = "Classroom Release • Core S1–S6 + B1–B2 • Section 101";
    document.querySelectorAll(".top .pill").forEach((pill) => {
      if (/Phase 1 Ready|S1–S5|S1-S5/i.test(pill.textContent || "")) {
        pill.textContent = "✓ Core release: S1–S6 + B1–B2";
      }
    });
  }

  function boot() {
    if (!isTeacherOnlyPage()) return;
    patchTeacherLabels();
    window.addEventListener("load", () => {
      setTimeout(loadArAnalytics, 0);
      setTimeout(loadMinimaxCoreAudit, 900);
      setTimeout(patchTeacherLabels, 1100);
    }, { once: true });
    if (document.readyState === "complete") {
      setTimeout(loadArAnalytics, 0);
      setTimeout(loadMinimaxCoreAudit, 900);
      setTimeout(patchTeacherLabels, 1100);
    }
  }

  window.AIQUEST_TEACHER_CONSOLE_CLEAN = { version: VERSION, loadArAnalytics, loadMinimaxCoreAudit };
  boot();
  console.log("[AIQuest] " + VERSION + " loaded");
})();
