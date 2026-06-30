/* EAP Word Quest • Teacher v242 Patch Loader
   Ensures the teacher report patches load only after teacher.html has
   defined its render function, then refreshes the current view once. */
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

  function loadScript(path, tag, done) {
    if (document.querySelector(`script[data-eap-teacher-runtime="${tag}"]`) || document.querySelector(`script[data-eap-runtime="${tag}"]`)) {
      done();
      return;
    }
    const script = document.createElement("script");
    script.src = path;
    script.async = false;
    if (tag.indexOf("logger") >= 0) script.dataset.eapRuntime = tag;
    else script.dataset.eapTeacherRuntime = tag;
    script.onload = done;
    script.onerror = () => {
      console.warn("[EAP Word Quest] teacher runtime did not load", tag);
      done();
    };
    document.head.appendChild(script);
  }

  function loadIdentitySafeLocalReport() {
    loadScript(
      "./eap-word-logger-v250-identity-preserve.js?v=20260630-v250-identity",
      "identity-preserve-logger",
      () => loadScript(
        "./eap-word-teacher-v249-local-ledger-truth.js?v=20260630-v249-local-ledger",
        "v249-local-ledger-truth",
        () => setTimeout(refreshTeacherView, 80)
      )
    );
  }

  function load() {
    if (loaded || window.__EAP_WORD_TEACHER_V241_CORE_TRUTH__) {
      loadIdentitySafeLocalReport();
      return;
    }
    loaded = true;
    const script = document.createElement("script");
    script.src = patchPath;
    script.async = false;
    script.dataset.eapTeacherRuntime = "v241-core-truth";
    script.onload = () => loadIdentitySafeLocalReport();
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
