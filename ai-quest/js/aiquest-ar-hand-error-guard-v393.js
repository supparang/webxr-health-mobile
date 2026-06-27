/* AI Quest AR v3.9.3 — MediaPipe error circuit breaker
   Keeps S1 AR playable with mouse/touch when MediaPipe Hands assets fail repeatedly.
   Does NOT alter score, completion, or Google Sheets events.
*/
(() => {
  "use strict";

  const KEY = "AIQUEST_AR_HAND_CIRCUIT_V393";
  const MAX_ERRORS = 3;
  let count = 0;
  let tripped = false;

  function isS1Ar() {
    const q = new URLSearchParams(location.search);
    const s = String(q.get("session") || "").toLowerCase();
    const ar = String(q.get("ar") || "").toLowerCase();
    return (s === "s1" || s === "m1") && ["hand","scanner","object"].includes(ar);
  }

  function status(text) {
    const id = "s1hs368";
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "block";
      el.textContent = text;
    }
  }

  function trip(reason) {
    if (tripped || !isS1Ar()) return;
    tripped = true;

    try {
      window.AIQUEST_S1_HAND_HOTFIX?.stop?.();
    } catch (_) {}

    try {
      sessionStorage.setItem(KEY, JSON.stringify({
        at: new Date().toISOString(),
        reason: String(reason || "MediaPipe asset error")
      }));
    } catch (_) {}

    status("Hand mode พักชั่วคราว • ใช้ mouse/touch เลือกคำตอบได้ตามปกติ");
    console.warn("[AIQuest AR] Hand circuit breaker activated; mouse/touch remains available.");
  }

  function relevant(message, filename) {
    const s = String(message || "") + " " + String(filename || "");
    return /hands_solution_assets_loader|@mediapipe\/hands|hands\.js|wasm/i.test(s);
  }

  window.addEventListener("error", (event) => {
    if (!isS1Ar() || tripped) return;
    if (!relevant(event.message, event.filename)) return;
    count += 1;
    if (count >= MAX_ERRORS) trip(event.message);
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (!isS1Ar() || tripped) return;
    const why = event && event.reason;
    if (!relevant(why && (why.message || why), "")) return;
    count += 1;
    if (count >= MAX_ERRORS) trip(why && (why.message || why));
  }, true);

  document.addEventListener("DOMContentLoaded", () => {
    if (!isS1Ar()) return;
    const old = (() => {
      try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) { return null; }
    })();
    if (old) {
      setTimeout(() => trip(old.reason), 450);
    }
  });

  console.log("[AIQuest AR] v3.9.3 hand error guard loaded");
})();
