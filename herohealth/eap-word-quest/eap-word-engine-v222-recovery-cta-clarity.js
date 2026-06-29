/* =========================================================
   EAP Word Quest • Recovery CTA Clarity
   File: /herohealth/eap-word-quest/eap-word-engine-v222-recovery-cta-clarity.js
   Version: v2.2.2-RECOVERY-CTA-CLARITY-122

   Learner-facing only:
   - When a Session is not yet passed, label the primary action as Recovery.
   - Tell the learner exactly how many more correct answers are needed.
   - Keeps the existing Core controller as the sole owner of item selection,
     scoring, gates, answer order, progress and logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.2-RECOVERY-CTA-CLARITY-122";
  if (window.__EAP_WORD_V222_RECOVERY_CTA__) return;
  window.__EAP_WORD_V222_RECOVERY_CTA__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const isSessionId = (value) => /^(S(?:1[0-5]|[1-9])|BG[1-5])$/i.test(norm(value));
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;

  function currentResult() {
    return window.EAP_V196_LAST_RESULT ||
      window.EAP_V203_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      window.EAP_V192_LAST_RESULT ||
      null;
  }

  function summaryActive() {
    return Boolean($("summaryScreen") && $("summaryScreen").classList.contains("active"));
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function applyCta() {
    if (!summaryActive()) return;
    const result = currentResult();
    if (!result) return;

    const sessionId = norm(result.sessionId).toUpperCase();
    if (!isSessionId(sessionId) || result.passed) return;

    const total = Math.max(1, Math.round(Number(result.total) || 1));
    const correct = Math.max(0, Math.round(Number(result.correct) || 0));
    const neededToPass = Math.max(0, Math.ceil((threshold(sessionId) / 100) * total) - correct);
    const next = $("nextMissionBtn");
    const replay = $("replayBtn");

    if (next) {
      setText(next, `เริ่ม ${sessionId} Recovery`);
      next.title = neededToPass
        ? `ต้องตอบถูกเพิ่มอีก ${neededToPass} ข้อเพื่อผ่าน ${sessionId}`
        : `เริ่ม ${sessionId} Recovery`;
      next.dataset.eapV222Recovery = sessionId;
    }
    if (replay) {
      setText(replay, `เล่น ${sessionId} อีกครั้ง`);
      replay.title = "เล่น Session เดิมอีกครั้งโดยใช้ชุดโจทย์ใหม่";
    }

    const plan = $("eapV218RecoveryPlan");
    if (plan && neededToPass > 0) {
      const noteId = "eapV222NearPassNote";
      let note = $(noteId);
      if (!note) {
        note = document.createElement("div");
        note.id = noteId;
        note.style.marginTop = "7px";
        note.style.fontWeight = "950";
        plan.appendChild(note);
      }
      setText(note, `เป้าหมายรอบถัดไป: ตอบถูกเพิ่มอีก ${neededToPass} ข้อเพื่อผ่าน ${sessionId}`);
    }
  }

  function prepareSession(event) {
    const button = event.target && event.target.closest ? event.target.closest("#nextMissionBtn,#replayBtn") : null;
    const result = currentResult();
    if (!button || !result || result.passed) return;
    const sessionId = norm(result.sessionId).toUpperCase();
    if (!isSessionId(sessionId)) return;
    if (document.body && document.body.dataset) document.body.dataset.sessionId = sessionId;
    const game = $("gameScreen");
    if (game && game.dataset) game.dataset.sessionId = sessionId;
  }

  document.addEventListener("click", (event) => {
    prepareSession(event);
    [80, 260, 620].forEach((delay) => setTimeout(applyCta, delay));
  }, true);
  window.addEventListener("eap-core-run-finished", () => [100, 300, 760].forEach((delay) => setTimeout(applyCta, delay)));
  [180, 550, 1200].forEach((delay) => setTimeout(applyCta, delay));
  setInterval(applyCta, 750);

  window.inspectEapV222 = () => {
    const result = currentResult();
    return {
      version:VERSION,
      sessionId:result && result.sessionId || "",
      passed:Boolean(result && result.passed),
      nextLabel:norm($("nextMissionBtn") && $("nextMissionBtn").textContent),
      replayLabel:norm($("replayBtn") && $("replayBtn").textContent)
    };
  };

  console.info("[EAP Word Quest] v222 recovery CTA clarity ready", { version:VERSION });
})();
