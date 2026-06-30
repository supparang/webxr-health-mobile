/* =========================================================
   EAP Word Quest • Core History Backfill
   File: /herohealth/eap-word-quest/eap-word-engine-v243-core-history-backfill.js
   Version: v2.4.3-CORE-HISTORY-BACKFILL-122

   Transfers actual locally stored Core pass records to the shared Sheets
   endpoint once, so a learner who completed work before cloud sync was
   configured does not need to replay 20 missions.

   It reads only the Core progress state already on the student's device.
   It never changes pass state, score, question pools, or local logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.3-CORE-HISTORY-BACKFILL-122";
  const GROUP = "122";
  const FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];
  const TITLES = {
    S1:"Mission Passport", S2:"UK Campus Decoder", S3:"The Broken Brief", BG1:"Global Learner Clearance",
    S4:"Signal Relay", S5:"Evidence Court", S6:"Summary Press Room", BG2:"Evidence Court Live",
    S7:"Tone Switchboard", S8:"Paragraph Repair Lab", S9:"Campus Solution Pitch", BG3:"Academic Makeover Studio",
    S10:"Data Detective", S11:"International Help Desk", S12:"Integrity Escape Room", BG4:"International Help Desk Crisis",
    S13:"Mini Lecture Heist", S14:"Presentation Under Pressure", S15:"Global Solution Summit", BG5:"Human Override Summit"
  };

  if (window.__EAP_WORD_V243_HISTORY_BACKFILL__) return;
  window.__EAP_WORD_V243_HISTORY_BACKFILL__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bool = (value) => value === true || String(value).toLowerCase() === "true";

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
      return false;
    }
  }

  function endpoint() {
    const helper = typeof window.getEapWordSheetEndpoint === "function" ? window.getEapWordSheetEndpoint() : "";
    return norm(helper || (window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint) || "");
  }

  function validEndpoint(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(url);
  }

  function profile() {
    const saved = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    return {
      studentId: norm(saved.studentId || saved.id || "anon"),
      studentName: norm(saved.studentName || saved.name || "Anonymous")
    };
  }

  function safeId(value) {
    return norm(value || "no-id").replace(/[^a-z0-9_-]/gi, "_") || "no-id";
  }

  function defaultTotal(sessionId) {
    if (sessionId === "BG5") return 24;
    return /^BG/.test(sessionId) ? 18 : 12;
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function buildRecords() {
    const who = profile();
    const stateKey = `EAP_WORD_QUEST_CORE_V196_STATE_${GROUP}_${safeId(who.studentId)}`;
    const state = readJson(stateKey, {}) || {};
    const sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    const result = [];

    FLOW.forEach((sessionId) => {
      const row = sessions[sessionId];
      if (!row || (!row.played && !row.passed)) return;

      const total = Math.max(1, Math.round(num(row.total, defaultTotal(sessionId))));
      const accuracy = Math.max(0, Math.min(100, Math.round(num(row.bestAccuracy, row.accuracy))));
      const score = Math.max(0, Math.round(num(row.bestScore, row.lastScore)));
      const passed = Boolean(row.passed) || (accuracy >= threshold(sessionId));
      const playedAt = norm(row.lastPlayed || state.updatedAt || new Date().toISOString());
      const fingerprint = ["v243-backfill", GROUP, who.studentId, sessionId, accuracy, score, playedAt.slice(0, 19)].join("|");

      result.push({
        source: "core-state-backfill-v243",
        course: "EAP",
        game: "EAP Word Quest",
        role: "Vocabulary Side Quest",
        group: GROUP,
        section: GROUP,
        studentId: who.studentId,
        studentName: who.studentName,
        sessionId,
        sessionTitle: TITLES[sessionId] || sessionId,
        sessionType: sessionId === "BG5" ? "finalBoss" : (/^BG/.test(sessionId) ? "boss" : "session"),
        correct: Math.max(0, Math.min(total, Math.round((accuracy / 100) * total))),
        total,
        accuracy,
        xp: score,
        score,
        maxCombo: Math.max(0, Math.round(num(row.maxCombo))),
        passed,
        passThreshold: threshold(sessionId),
        passStatus: passed ? "Passed" : "Needs Practice",
        cefrLevel: "",
        aiDifficulty: "",
        aiPrediction: "",
        hintUsed: 0,
        weakWords: [],
        itemTypeWeak: [],
        levelWeak: [],
        responseTimeAvg: 0,
        attempt: Math.max(1, Math.round(num(row.totalAttempts, 1))),
        bossHp: passed && /^BG/.test(sessionId) ? 0 : 1,
        bossMaxHp: /^BG/.test(sessionId) ? total : 0,
        isBoss: /^BG/.test(sessionId),
        playedAt,
        fingerprint
      });
    });

    return result;
  }

  function sentKey() {
    return `EAP_WORD_QUEST_CORE_HISTORY_BACKFILL_SENT_V243_${safeId(profile().studentId)}`;
  }

  function pendingRecords() {
    const sent = new Set(readJson(sentKey(), []));
    return buildRecords().filter((record) => !sent.has(record.fingerprint));
  }

  async function backfill() {
    const url = endpoint();
    if (!validEndpoint(url)) {
      return { ok:false, reason:"endpoint_not_configured", pending:pendingRecords().length };
    }

    const records = pendingRecords();
    if (!records.length) {
      return { ok:true, sent:0, pending:0, reason:"already_synced" };
    }

    const payload = {
      action: "eap_word_batch",
      schemaVersion: VERSION,
      clientTs: new Date().toISOString(),
      pageUrl: location.href,
      userAgent: navigator.userAgent || "",
      records
    };

    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const sent = new Set(readJson(sentKey(), []));
      records.forEach((record) => sent.add(record.fingerprint));
      writeJson(sentKey(), Array.from(sent).slice(-100));
      const result = { ok:true, sent:records.length, pending:0, updatedAt:new Date().toISOString() };
      window.EAP_WORD_V243_BACKFILL_STATUS = result;
      return result;
    } catch (err) {
      const result = { ok:false, reason:String(err && err.message || err), sent:0, pending:records.length };
      window.EAP_WORD_V243_BACKFILL_STATUS = result;
      return result;
    }
  }

  window.syncEapWordQuestHistoryToSheets = backfill;
  window.inspectEapWordQuestHistoryBackfill = () => ({
    version: VERSION,
    endpointConfigured: validEndpoint(endpoint()),
    pending: pendingRecords().length,
    status: window.EAP_WORD_V243_BACKFILL_STATUS || null
  });

  // Wait until the main config and shared endpoint have loaded.
  setTimeout(() => backfill(), 4200);
  console.info("[EAP Word Quest] v243 Core history backfill ready", window.inspectEapWordQuestHistoryBackfill());
})();
