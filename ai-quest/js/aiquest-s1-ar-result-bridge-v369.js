/* =========================================================
   CSAI2102 AI Quest — S1 AR Result Bridge + Auto Event Sync
   File: /ai-quest/js/aiquest-s1-ar-result-bridge-v369.js
   Version: v3.7.3-s1-ar-auto-event-sync

   Design:
   - AR is supplementary; never changes S1 main grade/accuracy.
   - On AR completion, sends one `s1_ar_complete` EVENT to Google Sheets.
   - Teacher reads that event separately from normal S1 attempts.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.7.3-s1-ar-auto-event-sync";
  const RESULT_KEYS = [
    "AIQUEST_S1_AR_RESULT_V368",
    "AIQUEST_S1_AR_RESULT_V366",
    "AIQUEST_S1_AR_RESULT_V365B",
    "AIQUEST_S1_AR_PRACTICE_RESULT_V365"
  ];
  const EVENT_SYNC_KEY = "AIQUEST_S1_AR_EVENT_SYNC_V373";
  const FALLBACK_ENDPOINT = "https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec";
  const $ = (id) => document.getElementById(id);

  let syncBusy = false;
  let lastVisualSignature = "";

  function asObject(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function getArResult() {
    const direct = window.AIQUEST_S1_AR_RESULT ||
      window.AIQUEST_S1_AR_PRACTICE?.getResult?.();

    if (direct && typeof direct === "object" && direct.arCompleted) return direct;

    for (const key of RESULT_KEYS) {
      try {
        const item = JSON.parse(localStorage.getItem(key) || "null");
        if (item && item.arCompleted && (item.sessionId === "s1" || item.missionId === "m1")) return item;
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
      inputMode: String(ar.inputMode || ar.arInputMode || "hand_or_mouse_touch"),
      arVersion: ar.version || "",
      completedAt: ar.finishedAt || new Date().toISOString()
    };
  }

  function getProfile() {
    const direct = window.AIQuestStorage?.getProfile?.() || {};
    if (direct.studentId) return direct;

    // Safe fallback for the existing AI Quest profile storage formats.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (!/aiquest|profile|classroom/i.test(key)) continue;
        const candidate = JSON.parse(localStorage.getItem(key) || "null");
        if (candidate && candidate.studentId) return candidate;
      }
    } catch (_) {}
    return {};
  }

  function syncSignature(ar) {
    return [
      ar.completedAt || "",
      ar.score || 0,
      ar.correct || 0,
      ar.total || 0,
      ar.helpUsed || 0
    ].join("|");
  }

  function readSyncState() {
    try { return JSON.parse(localStorage.getItem(EVENT_SYNC_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function writeSyncState(state) {
    try { localStorage.setItem(EVENT_SYNC_KEY, JSON.stringify(state || {})); }
    catch (_) {}
  }

  function endpoint() {
    const config = window.AIQuestDataContract?.loadConfig?.() || {};
    return config.appsScriptUrl || FALLBACK_ENDPOINT;
  }

  function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function eventPayload(ar, profile) {
    const eventId = makeId("s1ar");
    const trace = {
      activity: ar.activity,
      supplementary: true,
      completed: true,
      score: ar.score,
      accuracy: ar.accuracy,
      correct: ar.correct,
      total: ar.total,
      helpUsed: ar.helpUsed,
      usedSec: ar.usedSec,
      inputMode: ar.inputMode,
      arVersion: ar.arVersion,
      completedAt: ar.completedAt
    };

    const rawEvent = {
      eventId,
      attemptId: `s1_ar_practice_${String(profile.studentId || "anon")}_${Date.now()}`,
      studentId: String(profile.studentId || ""),
      sessionId: "s1",
      missionId: "m1",
      runMode: "practice",
      eventType: "s1_ar_complete",
      phase: "S1 AR Practice",
      itemId: "ai_object_scanner",
      prompt: "S1 AR Practice: AI Object Scanner",
      // teacherConsole already returns `yourAnswer`, so this is deliberate and safe.
      yourAnswer: JSON.stringify(trace),
      correctAnswer: "completed",
      isCorrect: true,
      scoreDelta: Number(ar.score || 0),
      combo: Number(ar.correct || 0),
      helpLeft: Math.max(0, 3 - Number(ar.helpUsed || 0)),
      clientTs: ar.completedAt,
      extraJson: {
        eventKind: "s1_ar_practice",
        s1ArPractice: trace
      }
    };

    return window.AIQuestDataContract?.buildEvent
      ? window.AIQuestDataContract.buildEvent(rawEvent, {
          attemptId: rawEvent.attemptId,
          studentId: rawEvent.studentId,
          sessionId: "s1",
          missionId: "m1"
        })
      : rawEvent;
  }

  async function autoSyncArEvent() {
    const ar = evidence();
    if (!ar || syncBusy) return false;

    const signature = syncSignature(ar);
    const state = readSyncState();
    if (state.signature === signature && state.status === "queued") return true;

    const profile = getProfile();
    if (!profile.studentId) {
      console.warn("[AIQuest S1 AR Sync] profile missing; AR evidence remains local");
      return false;
    }

    const url = endpoint();
    if (!url) {
      console.warn("[AIQuest S1 AR Sync] Apps Script endpoint missing");
      return false;
    }

    const event = eventPayload(ar, profile);
    const body = JSON.stringify({ action: "sync_v23", kind: "event", payload: event });

    syncBusy = true;
    try {
      // text/plain + no-cors avoids a browser preflight while Apps Script still parses JSON body.
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body
      });

      writeSyncState({
        signature,
        status: "queued",
        eventId: event.eventId,
        studentId: String(profile.studentId),
        queuedAt: new Date().toISOString()
      });

      console.log("[AIQuest S1 AR Sync] queued s1_ar_complete event", {
        eventId: event.eventId,
        studentId: profile.studentId,
        score: ar.score,
        correct: ar.correct,
        total: ar.total
      });

      window.dispatchEvent(new CustomEvent("aiquest:s1-ar-event-queued", {
        detail: { event, evidence: ar }
      }));
      return true;
    } catch (error) {
      console.warn("[AIQuest S1 AR Sync] event send failed", error);
      return false;
    } finally {
      syncBusy = false;
    }
  }

  // Retained for normal S1 submissions: adds AR evidence into the related S1 attempt,
  // but AR event sync does not require a normal S1 attempt to be created.
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
      extraJson: { ...extra, s1ArPractice: ar }
    };

    console.log("[AIQuest S1 AR Bridge] attached AR evidence to S1 attempt", {
      sessionId: next.sessionId,
      missionId: next.missionId,
      arScore: next.arScore
    });
    return next;
  }

  function wrap(owner, method, label) {
    if (!owner || typeof owner[method] !== "function") return;
    const original = owner[method];
    if (original.__s1ArBridgeV373) return;

    function wrapped(attempt, ...rest) {
      return original.call(this, decorate(attempt), ...rest);
    }
    wrapped.__s1ArBridgeV373 = true;
    owner[method] = wrapped;
    console.log("[AIQuest S1 AR Bridge] wrapped", label);
  }

  function installAttemptBridge() {
    wrap(window.AIQuestSync, "submitAttempt", "AIQuestSync.submitAttempt");
    wrap(window.AIQuestCloudLogger, "sendAttempt", "AIQuestCloudLogger.sendAttempt");
    ["saveAttempt", "addAttempt", "storeAttempt"].forEach((method) => {
      wrap(window.AIQuestStorage, method, `AIQuestStorage.${method}`);
    });
  }

  function renderStatus() {
    const old = $("s1ArBridgeStatusV369");
    if (old) old.remove();

    const ar = evidence();
    const entry = $("s1entry368") || $("s1arentry368") || $("s1arentry366");
    if (!entry || !ar) return;

    const state = readSyncState();
    const syncOk = state.signature === syncSignature(ar) && state.status === "queued";
    const status = document.createElement("div");
    status.id = "s1ArBridgeStatusV369";
    status.style.cssText = [
      "clear:both", "margin-top:12px", "padding:10px 12px", "border-radius:14px",
      `background:${syncOk ? "rgba(16,185,129,.13)" : "rgba(34,211,238,.12)"}`,
      `border:1px solid ${syncOk ? "rgba(16,185,129,.30)" : "rgba(34,211,238,.28)"}`,
      `color:${syncOk ? "#bbf7d0" : "#cffafe"}`,
      "font-size:12px", "line-height:1.45", "font-weight:800"
    ].join(";");

    status.innerHTML = syncOk
      ? `<strong>✓ ส่ง AR Practice แล้ว: ${ar.correct}/${ar.total} • ${ar.score}%</strong><br>Teacher Dashboard จะแสดงเป็นกิจกรรมเสริมหลัง Refresh`
      : `<strong>AR Practice ล่าสุด: ${ar.correct}/${ar.total} • ${ar.score}%</strong><br>กำลังเตรียมส่งหลักฐานกิจกรรมเสริมไปยัง Teacher Dashboard`;
    entry.appendChild(status);
  }

  function tick() {
    installAttemptBridge();

    const ar = evidence();
    const signature = ar ? syncSignature(ar) : "";
    if (signature !== lastVisualSignature) {
      lastVisualSignature = signature;
      renderStatus();
    }

    if (ar) {
      autoSyncArEvent().then((ok) => {
        if (ok) renderStatus();
      });
    }
  }

  function boot() {
    tick();
    setInterval(tick, 900);
    window.addEventListener("aiquest:s1-ar-start", () => {
      // New run means the local result will be replaced only when it finishes.
      lastVisualSignature = "";
    });
  }

  window.AIQUEST_S1_AR_RESULT_BRIDGE = {
    version: VERSION,
    getArResult,
    getEvidence: evidence,
    decorateAttempt: decorate,
    syncNow: autoSyncArEvent,
    getSyncState: readSyncState
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

  console.log("[AIQuest] " + VERSION + " loaded", window.AIQUEST_S1_AR_RESULT_BRIDGE);
})();
