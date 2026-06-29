/* =========================================================
   EAP Word Quest • Recent Pass Bridge
   File: /herohealth/eap-word-quest/eap-word-engine-v221-recent-pass-bridge.js
   Version: v2.2.1-RECENT-PASS-BRIDGE-122

   On a reload immediately after a passed Session, runtime result globals are
   empty but the local learning log still has the completed result. Restore
   only a recent passed row for the active learner, then let v220 reconcile
   that row into the Core state. No score, gate, or result is invented.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.1-RECENT-PASS-BRIDGE-122";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";
  const WINDOW_MS = 6 * 60 * 60 * 1000;
  const VALID = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);

  if (window.__EAP_WORD_V221_RECENT_PASS_BRIDGE__) return;
  window.__EAP_WORD_V221_RECENT_PASS_BRIDGE__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function profileId() {
    const saved = readJson(PROFILE_KEY, {}) || {};
    const input = document.getElementById("studentIdInput");
    return norm((input && input.value) || saved.studentId || saved.id || "");
  }

  function normalise(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const sessionId = norm(source.sessionId).toUpperCase();
    const correct = Math.max(0, Math.round(num(source.correct)));
    const total = Math.max(1, Math.round(num(source.total, 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(source.accuracy, (correct / total) * 100))));
    const playedAt = norm(source.playedAt || source.endedAt || source.at || "");
    return {
      raw:source,
      sessionId,
      correct,
      total,
      accuracy,
      passed:Boolean(source.passed || accuracy >= threshold(sessionId)),
      playedAt
    };
  }

  function recentPassedLog() {
    const activeId = profileId();
    const now = Date.now();
    const rows = readJson(LOG_KEY, []);
    if (!Array.isArray(rows)) return null;

    return rows
      .map(normalise)
      .filter((row) => {
        const loggedId = norm(row.raw.studentId || row.raw.id || "");
        const when = new Date(row.playedAt).getTime();
        const age = now - when;
        return row.passed && VALID.has(row.sessionId) &&
          (!activeId || !loggedId || activeId === loggedId) &&
          Number.isFinite(when) && age >= -60000 && age <= WINDOW_MS;
      })
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))[0] || null;
  }

  function bridge() {
    if (window.EAP_V196_LAST_RESULT) return { bridged:false, reason:"live_result_present" };
    const row = recentPassedLog();
    if (!row) return { bridged:false, reason:"no_recent_pass" };

    window.EAP_V196_LAST_RESULT = row.raw;
    window.EAP_V195_LAST_RESULT = row.raw;
    window.EAP_V203_LAST_RESULT = row.raw;

    let truth = null;
    try {
      truth = typeof window.inspectEapV220 === "function" ? window.inspectEapV220() : null;
    } catch (err) {
      truth = { error:String(err && err.message || err) };
    }
    return { bridged:true, sessionId:row.sessionId, accuracy:row.accuracy, truth };
  }

  [80, 300, 900].forEach((delay) => setTimeout(() => {
    const report = bridge();
    window.EAP_WORD_V221_BRIDGE = report;
  }, delay));

  window.inspectEapV221 = () => ({ version:VERSION, bridge:window.EAP_WORD_V221_BRIDGE || null, recent:recentPassedLog() });
  console.info("[EAP Word Quest] v221 recent pass bridge ready", { version:VERSION, group:GROUP });
})();
