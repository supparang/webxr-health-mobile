/* =========================================================
   EAP Word Quest • Recovery CTA Clarity
   File: /herohealth/eap-word-quest/eap-word-engine-v222-recovery-cta-clarity.js
   Version: v2.2.2-RECOVERY-CTA-LOCK-122

   Learner-facing only:
   - When a Session is not yet passed, label the primary action as Recovery.
   - Tell the learner exactly how many more correct answers are needed.
   - Keep a single visible CTA label even while older path patches refresh
     their underlying label in the background.
   - Core remains the sole owner of item selection, scoring, gates, answer
     order, progress and logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.2-RECOVERY-CTA-LOCK-122";
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

  function addStyle() {
    if ($("eapV222RecoveryCtaStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV222RecoveryCtaStyle";
    style.textContent = `
      /* Older route patches can refresh the DOM text. The recovery label is
         painted once above it so learners never see competing instructions. */
      #nextMissionBtn[data-eap-v222-visible-label]{position:relative!important;color:transparent!important;text-shadow:none!important}
      #nextMissionBtn[data-eap-v222-visible-label]::after{
        content:attr(data-eap-v222-visible-label);
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        color:#fff;font:inherit;font-weight:900;line-height:inherit;pointer-events:none;
      }
    `;
    document.head.appendChild(style);
  }

  function clearVisibleLock() {
    const next = $("nextMissionBtn");
    if (!next) return;
    delete next.dataset.eapV222VisibleLabel;
    next.removeAttribute("aria-label");
  }

  function applyCta() {
    addStyle();
    if (!summaryActive()) {
      clearVisibleLock();
      return;
    }
    const result = currentResult();
    if (!result) return;

    const sessionId = norm(result.sessionId).toUpperCase();
    if (!isSessionId(sessionId) || result.passed) {
      clearVisibleLock();
      return;
    }

    const total = Math.max(1, Math.round(Number(result.total) || 1));
    const correct = Math.max(0, Math.round(Number(result.correct) || 0));
    const neededToPass = Math.max(0, Math.ceil((threshold(sessionId) / 100) * total) - correct);
    const next = $("nextMissionBtn");
    const replay = $("replayBtn");
    const recoveryLabel = `เริ่ม ${sessionId} Recovery`;

    if (next) {
      /* Semantic text remains useful to assistive tech; the visual lock below
         prevents a competing legacy label from flashing on screen. */
      setText(next, recoveryLabel);
      next.dataset.eapV222VisibleLabel = recoveryLabel;
      next.setAttribute("aria-label", recoveryLabel);
      next.title = neededToPass
        ? `ต้องตอบถูกเพิ่มอีก ${neededToPass} ข้อเพื่อผ่าน ${sessionId}`
        : recoveryLabel;
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

  window.inspectEapV222 = () => {
    const result = currentResult();
    const next = $("nextMissionBtn");
    return {
      version:VERSION,
      sessionId:result && result.sessionId || "",
      passed:Boolean(result && result.passed),
      visibleLabel:norm(next && next.dataset.eapV222VisibleLabel),
      semanticLabel:norm(next && next.textContent),
      replayLabel:norm($("replayBtn") && $("replayBtn").textContent)
    };
  };

  console.info("[EAP Word Quest] v222 recovery CTA lock ready", { version:VERSION });
})();
