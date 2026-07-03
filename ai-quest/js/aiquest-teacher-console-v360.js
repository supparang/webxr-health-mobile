/* =========================================================
   CSAI2102 AI Quest
   Teacher Console Runtime v5.2.0
   ---------------------------------------------------------
   Loads AR analytics, the Minimax-aligned Core Audit, and the
   separate Module 3 Phase 2 audit (S7/S8/S9/B3).
========================================================= */
(() => {
  "use strict";
  const VERSION = "v5.2.0-teacher-console-core-phase2-audits";

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

  function loadPhase2Audit() {
    if (!isTeacherOnlyPage()) return;
    loadScript("aiquestPhase2AuditV520Script", "./js/aiquest-teacher-phase2-audit-v520.js?v=20260704-phase2audit520");
  }

  function patchTeacherLabels() {
    const sub = document.querySelector(".top .sub");
    if (sub) sub.textContent = "Classroom Release • Core + Phase 2 • Section 101";
    document.querySelectorAll(".top .pill").forEach((pill) => {
      if (/Phase 1 Ready|S1–S5|S1-S5/i.test(pill.textContent || "")) {
        pill.textContent = "✓ Core release: S1–S6 + B1–B2";
      }
    });
  }

  function boot() {
    if (!isTeacherOnlyPage()) return;
    patchTeacherLabels();
    const loadAll = () => {
      setTimeout(loadArAnalytics, 0);
      setTimeout(loadMinimaxCoreAudit, 900);
      setTimeout(loadPhase2Audit, 1450);
      setTimeout(patchTeacherLabels, 1700);
    };
    window.addEventListener("load", loadAll, { once: true });
    if (document.readyState === "complete") loadAll();
  }

  window.AIQUEST_TEACHER_CONSOLE_CLEAN = { version: VERSION, loadArAnalytics, loadMinimaxCoreAudit, loadPhase2Audit };
  boot();
  console.log("[AIQuest] " + VERSION + " loaded");
})();
