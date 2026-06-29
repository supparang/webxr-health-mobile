/* =========================================================
   EAP Word Quest • Progress Ledger Reconciliation
   File: /herohealth/eap-word-quest/eap-word-engine-v220-progress-ledger-reconcile.js
   Version: v2.2.0-PROGRESS-LEDGER-RECONCILE-122

   Safety purpose:
   A completed screen can never say "passed" while the Arc Path still says
   the same Session is not passed. The Core controller remains the source of
   scoring. This file only repairs a missing compact progress write from the
   same just-finished result or its newest compact learning-log record.

   It preserves: answer marking, XP, pass threshold, unlock rules, question
   selection, Teacher log records, and prior completed sessions.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.0-PROGRESS-LEDGER-RECONCILE-122";
  const GROUP = "122";
  const STATE_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";
  const RECENT_WINDOW_MS = 20 * 60 * 1000;
  const VALID_IDS = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2","S7","S8","S9","BG3",
    "S10","S11","S12","BG4","S13","S14","S15","BG5"
  ]);

  if (window.__EAP_WORD_V220_PROGRESS_LEDGER__) return;
  window.__EAP_WORD_V220_PROGRESS_LEDGER__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const isId = (value) => VALID_IDS.has(norm(value).toUpperCase());

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("[EAP Word Quest] v220 could not write progress state", err);
      return false;
    }
  }

  function profile() {
    const saved = readJson(PROFILE_KEY, {}) || {};
    const studentId = norm(($("studentIdInput") && $("studentIdInput").value) || saved.studentId || saved.id || "no-id");
    const studentName = norm(($("studentNameInput") && $("studentNameInput").value) || saved.studentName || saved.name || "Hero");
    return { studentId, studentName };
  }

  function stateKey() {
    const p = profile();
    const id = norm(p.studentId || "anon").replace(/[^a-z0-9_-]/gi, "_") || "anon";
    return `${STATE_PREFIX}_${GROUP}_${id}`;
  }

  function passThreshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/i.test(sessionId) ? 70 : 60;
  }

  function normaliseResult(source) {
    const result = source && typeof source === "object" ? source : {};
    const sessionId = norm(result.sessionId).toUpperCase();
    const correct = Math.max(0, Math.round(num(result.correct)));
    const total = Math.max(1, Math.round(num(result.total, 1)));
    const accuracy = clamp(Math.round(num(result.accuracy, (correct / total) * 100)), 0, 100);
    const threshold = num(result.passThreshold, passThreshold(sessionId));
    return {
      sessionId,
      correct,
      total,
      accuracy,
      score:Math.max(0, Math.round(num(result.score, result.xp))),
      maxCombo:Math.max(0, Math.round(num(result.maxCombo))),
      passed:Boolean(result.passed || accuracy >= threshold),
      playedAt:norm(result.playedAt || result.endedAt || result.at || new Date().toISOString()),
      raw:result
    };
  }

  function latestPassedLog() {
    const p = profile();
    const rows = readJson(LOG_KEY, []);
    if (!Array.isArray(rows)) return null;
    const now = Date.now();
    return rows
      .map(normaliseResult)
      .filter((row) => {
        if (!isId(row.sessionId) || !row.passed) return false;
        const raw = row.raw || {};
        const logStudent = norm(raw.studentId || raw.id);
        const age = now - new Date(row.playedAt).getTime();
        return (!logStudent || logStudent === p.studentId) && Number.isFinite(age) && age >= -60000 && age <= RECENT_WINDOW_MS;
      })
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))[0] || null;
  }

  function repairFromResult(input, source = "event") {
    const result = normaliseResult(input);
    if (!isId(result.sessionId) || !result.passed) return { repaired:false, reason:"not_a_new_pass", result };

    const key = stateKey();
    const state = readJson(key, {}) || {};
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = GROUP;
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0, 36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const old = state.sessions[result.sessionId] || {};
    const alreadyPassed = Boolean(old.passed);
    const shouldRepair = !alreadyPassed || num(old.bestAccuracy, -1) < result.accuracy || !old.played;
    if (!shouldRepair) return { repaired:false, reason:"already_synced", result };

    state.sessions[result.sessionId] = {
      played:true,
      passed:true,
      accuracy:Math.max(result.accuracy, num(old.accuracy)),
      bestAccuracy:Math.max(result.accuracy, num(old.bestAccuracy, old.accuracy)),
      bestScore:Math.max(result.score, num(old.bestScore, old.lastScore)),
      lastAccuracy:result.accuracy,
      lastScore:result.score,
      totalAttempts:Math.max(1, Math.round(num(old.totalAttempts, 0))),
      lastPlayed:result.playedAt
    };
    state.updatedAt = new Date().toISOString();

    const wrote = writeJson(key, state);
    const report = { repaired:wrote, source, sessionId:result.sessionId, accuracy:result.accuracy, stateKey:key };
    window.EAP_WORD_V220_LAST_RECONCILE = report;
    return report;
  }

  function forceSummaryTruth(result) {
    if (!result || !result.passed) return;
    /* v203 listens to this event and recomputes Arc Path after the state repair. */
    window.dispatchEvent(new CustomEvent("eap-core-run-finished", { detail:result.raw || result }));
  }

  function reconcileRecentLog() {
    const recent = latestPassedLog();
    if (!recent) return { repaired:false, reason:"no_recent_pass_log" };
    const report = repairFromResult(recent.raw, "recent_log");
    return report;
  }

  window.addEventListener("eap-core-run-finished", (event) => {
    const report = repairFromResult(event && event.detail, "event");
    if (report.repaired) {
      [0, 80, 260].forEach((delay) => setTimeout(() => forceSummaryTruth(normaliseResult(event.detail)), delay));
    }
  });

  /* Repairs a just-finished pass if the learner refreshes at the summary before
     the original compact-state write became visible to the Arc UI. */
  [180, 650, 1400].forEach((delay) => setTimeout(() => {
    const report = reconcileRecentLog();
    if (report.repaired) {
      const result = latestPassedLog();
      if (result) forceSummaryTruth(result);
    }
  }, delay));

  window.inspectEapV220ProgressLedger = () => ({
    version:VERSION,
    lastReconcile:window.EAP_WORD_V220_LAST_RECONCILE || null,
    recentPassedLog:latestPassedLog(),
    stateKey:stateKey(),
    progress:typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null
  });

  console.info("[EAP Word Quest] v220 progress ledger reconciliation ready", { version:VERSION });
})();
