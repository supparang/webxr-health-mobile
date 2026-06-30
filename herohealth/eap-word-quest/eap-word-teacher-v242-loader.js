/* EAP Word Quest • Teacher v242 Patch Loader
   Ensures v241 wraps report-core only after teacher.html has finished
   defining its render function, then refreshes the current view once. */
(() => {
  "use strict";
  if (window.__EAP_WORD_TEACHER_V242_LOADER__) return;
  window.__EAP_WORD_TEACHER_V242_LOADER__ = true;

  const patchPath = "./eap-word-teacher-v241-core-truth-layout.js?v=20260630-v241-core-truth";
  let loaded = false;

  function ready() {
    return typeof window.buildEapTeacherReport === "function" && Boolean(document.getElementById("refreshBtn"));
  }

  function refreshTeacherView() {
    const button = document.getElementById("refreshBtn");
    if (button && typeof button.click === "function") button.click();
  }

  function load() {
    if (loaded || window.__EAP_WORD_TEACHER_V241_CORE_TRUTH__) {
      setTimeout(refreshTeacherView, 40);
      return;
    }
    loaded = true;
    const script = document.createElement("script");
    script.src = patchPath;
    script.async = false;
    script.dataset.eapTeacherRuntime = "v241-core-truth";
    script.onload = () => setTimeout(refreshTeacherView, 40);
    script.onerror = () => console.warn("[EAP Word Quest] teacher v241 patch did not load");
    document.head.appendChild(script);
  }

  function wait(tries) {
    if (ready()) return load();
    if (tries >= 80) return;
    setTimeout(() => wait(tries + 1), 25);
  }

  wait(0);
})();
