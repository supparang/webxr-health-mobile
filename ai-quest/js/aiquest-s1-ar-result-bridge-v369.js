/* =========================================================
   CSAI2102 AI Quest — S1 AR Result Bridge
   File: /ai-quest/js/aiquest-s1-ar-result-bridge-v369.js
   Version: v3.6.9-s1-ar-result-bridge

   Purpose:
   Attach S1 AR Practice evidence to the next S1 attempt
   without overwriting the normal S1 score or accuracy.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.6.9-s1-ar-result-bridge";
  const RESULT_KEYS = [
    "AIQUEST_S1_AR_RESULT_V368",
    "AIQUEST_S1_AR_RESULT_V366",
    "AIQUEST_S1_AR_RESULT_V365B",
    "AIQUEST_S1_AR_PRACTICE_RESULT_V365"
  ];

  const $ = (id) => document.getElementById(id);

  function asObject(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function getArResult() {
    const direct = window.AIQUEST_S1_AR_RESULT ||
      window.AIQUEST_S1_AR_PRACTICE?.getResult?.();

    if (direct && typeof direct === "object" && direct.arCompleted) {
      return direct;
    }

    for (const key of RESULT_KEYS) {
      try {
        const item = JSON.parse(localStorage.getItem(key) || "null");
        if (item && item.arCompleted && (item.sessionId === "s1" || item.missionId === "m1")) {
          return item;
        }
      } catch (_) {}
    }
    return null;
  }

  function sessionKey(value) {
    const raw = String(value || "").toLowerCase().replace(/[\s_\-:]+/g, "");
    if (["s1", "m1", "session1", "mission1", "aiawakening"].includes(raw)) return "s1";
    return raw;
  }

  function isS1(attempt) {
    const src = attempt || {};
    return sessionKey(src.sessionId) === "s1" ||
      sessionKey(src.missionId) === "s1" ||
      sessionKey(src.missionId) === "m1";
  }

  function evidence() {
    const ar = getArResult();
    if (!ar || !ar.arCompleted) return null;

    const total = Number(ar.total || 0);
    const correct = Number(ar.correct || 0);
    const score = Math.round(Number(ar.arScore ?? ar.accuracy ?? (total ? correct * 100 / total : 0)));

    return {
      activity: "S1 AR Practice: AI Object Scanner",
      supplementary: true,
      completed: true,
      score,
      accuracy: score,
      correct,
      total,
      helpUsed: Number(ar.helpUsed || 0),
      usedSec: Number(ar.usedSec || 0),
      inputMode: "hand_or_mouse_touch",
      arVersion: ar.version || "",
      completedAt: ar.finishedAt || new Date().toISOString()
    };
  }

  function decorate(attempt) {
    if (!attempt || typeof attempt !== "object" || !isS1(attempt)) return attempt;

    const ar = evidence();
    if (!ar) return attempt;

    const extra = asObject(attempt.extraJson);
    if (extra.s1ArPractice?.completedAt === ar.completedAt) return attempt;

    const next = {
      ...attempt,
      arCompleted: true,
      arActivity: ar.activity,
      arSupplementary: true,
      arScore: ar.score,
      arAccuracy: ar.accuracy,
      arCorrect: ar.correct,
      arTotal: ar.total,
      arHelpUsed: ar.helpUsed,
      arUsedSec: ar.usedSec,
      arInputMode: ar.inputMode,
      extraJson: {
        ...extra,
        s1ArPractice: ar
      }
    };

    console.log("[AIQuest S1 AR Bridge] attached AR evidence", {
      sessionId: next.sessionId,
      missionId: next.missionId,
      arScore: next.arScore,
      arCorrect: next.arCorrect,
      arTotal: next.arTotal
    });

    window.dispatchEvent(new CustomEvent("aiquest:s1-ar-attached-to-attempt", {
      detail: { attempt: next, arEvidence: ar }
    }));
    return next;
  }

  function wrap(owner, method, label) {
    if (!owner || typeof owner[method] !== "function") return;
    const original = owner[method];
    if (original.__s1ArBridgeV369) return;

    function wrapped(attempt, ...rest) {
      return original.call(this, decorate(attempt), ...rest);
    }

    wrapped.__s1ArBridgeV369 = true;
    owner[method] = wrapped;
    console.log("[AIQuest S1 AR Bridge] wrapped", label);
  }

  function installNetworkBridge() {
    // submitAttemptWithFallback() in index calls these global adapters at runtime.
    wrap(window.AIQuestSync, "submitAttempt", "AIQuestSync.submitAttempt");
    wrap(window.AIQuestCloudLogger, "sendAttempt", "AIQuestCloudLogger.sendAttempt");

    // Optional local copies, when the storage API exposes a writer.
    ["saveAttempt", "addAttempt", "storeAttempt"].forEach((method) => {
      wrap(window.AIQuestStorage, method, `AIQuestStorage.${method}`);
    });
  }

  function renderStudentStatus() {
    const old = $("s1ArBridgeStatusV369");
    if (old) old.remove();

    const ar = evidence();
    const entry = $("s1entry368") || $("s1arentry368") || $("s1arentry366");
    if (!entry || !ar) return;

    const status = document.createElement("div");
    status.id = "s1ArBridgeStatusV369";
    status.style.cssText = [
      "clear:both",
      "margin-top:12px",
      "padding:10px 12px",
      "border-radius:14px",
      "background:rgba(16,185,129,.13)",
      "border:1px solid rgba(16,185,129,.30)",
      "color:#bbf7d0",
      "font-size:12px",
      "line-height:1.45",
      "font-weight:800"
    ].join(";");

    status.innerHTML = `
      <strong>✓ AR Practice ล่าสุด: ${ar.correct}/${ar.total} • ${ar.score}%</strong><br>
      กิจกรรมเสริมนี้จะถูกแนบกับผล S1 เมื่อกดบันทึกเข้า Google Sheets โดยไม่ทับคะแนน S1 หลัก
    `;
    entry.appendChild(status);
  }

  function boot() {
    installNetworkBridge();
    renderStudentStatus();

    let lastSignature = "";
    setInterval(() => {
      installNetworkBridge();
      const ar = evidence();
      const signature = ar ? `${ar.completedAt}|${ar.score}|${ar.correct}|${ar.total}` : "";
      if (signature !== lastSignature) {
        lastSignature = signature;
        renderStudentStatus();
      }
    }, 650);
  }

  window.AIQUEST_S1_AR_RESULT_BRIDGE = {
    version: VERSION,
    getArResult,
    getEvidence: evidence,
    decorateAttempt: decorate,
    install: installNetworkBridge
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

  console.log("[AIQuest] " + VERSION + " loaded", window.AIQUEST_S1_AR_RESULT_BRIDGE);
})();
