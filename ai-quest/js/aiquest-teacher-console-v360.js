/* =========================================================
   CSAI2102 AI Quest
   Teacher Console Clean Shim
   File: /ai-quest/js/aiquest-teacher-console-v360.js
   Version: v3.7.1-teacher-console-clean

   Replaces an obsolete file that had a JavaScript syntax error.
   Teacher-only dashboard functionality stays in:
   aiquest-teacher-only-dashboard-v360.js

   This shim safely loads the S1 AR analytics extension on teacher.html.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.7.1-teacher-console-clean";

  function isTeacherOnlyPage() {
    return !!window.AIQUEST_FORCE_TEACHER_PAGE ||
      !!window.AIQUEST_TEACHER_ONLY_PAGE ||
      /\/teacher\.html$/i.test(location.pathname);
  }

  function loadArAnalytics() {
    if (!isTeacherOnlyPage()) return;

    const id = "aiquestTeacherS1ArAnalyticsV371";
    if (document.getElementById(id)) return;

    const script = document.createElement("script");
    script.id = id;
    script.src = "./js/aiquest-teacher-s1-ar-analytics-v371.js?v=20260625-teacherclean371";
    script.async = false;
    script.onload = () => console.log("[AIQuest] S1 AR teacher analytics activated");
    script.onerror = () => console.warn("[AIQuest] Unable to load S1 AR teacher analytics");
    document.head.appendChild(script);
  }

  function boot() {
    if (!isTeacherOnlyPage()) return;
    window.addEventListener("load", () => setTimeout(loadArAnalytics, 0), { once: true });
    if (document.readyState === "complete") setTimeout(loadArAnalytics, 0);
  }

  window.AIQUEST_TEACHER_CONSOLE_CLEAN = {
    version: VERSION,
    loadArAnalytics
  };

  boot();
  console.log("[AIQuest] " + VERSION + " loaded");
})();
