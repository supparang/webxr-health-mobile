/* =========================================================
   EAP Word Quest • Core Cloud Sync
   File: /herohealth/eap-word-quest/eap-word-engine-v240-core-cloud-sync.js
   Version: v2.4.0-CORE-CLOUD-SYNC-122

   - Listens to the Core controller's completed-round event.
   - Reuses the exact result already recorded locally by the logger.
   - Queues unsent records safely in localStorage.
   - Sends to the deployed Apps Script endpoint using a simple text/plain POST
     so the request does not require browser CORS preflight.

   No endpoint is assumed. Until the teacher adds a deployed endpoint in
   eap-word-sheet-config.js, local logging continues normally.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.0-CORE-CLOUD-SYNC-122";
  const GROUP = "122";
  const OUTBOX_KEY = "EAP_WORD_QUEST_SHEET_OUTBOX_V240";
  const SENT_KEY = "EAP_WORD_QUEST_SHEET_SENT_V240";
  const MAX_OUTBOX = 180;

  if (window.__EAP_WORD_V240_CLOUD_SYNC__) return;
  window.__EAP_WORD_V240_CLOUD_SYNC__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

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
      console.warn("[EAP Word Quest] v240 storage write skipped", err);
      return false;
    }
  }

  function endpoint() {
    const fromHelper = typeof window.getEapWordSheetEndpoint === "function"
      ? window.getEapWordSheetEndpoint()
      : "";
    const fromConfig = window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint;
    return norm(fromHelper || fromConfig || "");
  }

  function validEndpoint(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(url);
  }

  function recordFrom(result) {
    const r = result && typeof result === "object" ? result : {};
    const playedAt = norm(r.playedAt || r.endedAt || new Date().toISOString());
    const studentId = norm(r.studentId || "anon");
    const sessionId = norm(r.sessionId || "S1").toUpperCase();
    const correct = Math.max(0, Math.round(num(r.correct)));
    const total = Math.max(1, Math.round(num(r.total, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(r.accuracy, (correct / total) * 100))));
    const fingerprint = norm(r.fingerprint) || [GROUP, studentId, sessionId, correct, total, accuracy, playedAt.slice(0,19)].join("|");

    return {
      action: "eap_word_attempt",
      schemaVersion: VERSION,
      clientTs: playedAt,
      pageUrl: location.href,
      userAgent: navigator.userAgent || "",
      record: {
        logVersion: r.logVersion || VERSION,
        source: r.source || "core-bank-v196",
        course: "EAP",
        game: "EAP Word Quest",
        role: "Vocabulary Side Quest",
        mainGame: "EAP Hero Save the Society",
        group: GROUP,
        section: GROUP,
        studentName: norm(r.studentName || "Anonymous"),
        studentId,
        arcId: norm(r.arcId),
        arc: norm(r.arc),
        sessionId,
        sessionTitle: norm(r.sessionTitle || sessionId),
        sessionType: norm(r.sessionType || (/^BG/.test(sessionId) ? "boss" : "session")),
        correct,
        total,
        accuracy,
        xp: Math.max(0, Math.round(num(r.xp, r.score))),
        score: Math.max(0, Math.round(num(r.score, r.xp))),
        maxCombo: Math.max(0, Math.round(num(r.maxCombo))),
        passed: Boolean(r.passed),
        passThreshold: Math.max(0, Math.round(num(r.passThreshold, sessionId === "BG5" ? 75 : /^BG/.test(sessionId) ? 70 : 60))),
        passStatus: norm(r.passStatus),
        cefrLevel: norm(r.cefrLevel),
        aiDifficulty: norm(r.aiDifficulty),
        aiPrediction: norm(r.aiPrediction),
        hintUsed: Math.max(0, Math.round(num(r.hintUsed))),
        weakWords: Array.isArray(r.weakWords) ? r.weakWords : [],
        itemTypeWeak: Array.isArray(r.itemTypeWeak) ? r.itemTypeWeak : [],
        levelWeak: Array.isArray(r.levelWeak) ? r.levelWeak : [],
        responseTimeAvg: Math.max(0, num(r.responseTimeAvg)),
        attempt: Math.max(1, Math.round(num(r.attempt, 1))),
        bossHp: Math.max(0, Math.round(num(r.bossHp))),
        bossMaxHp: Math.max(0, Math.round(num(r.bossMaxHp))),
        isBoss: Boolean(r.isBoss || /^BG/.test(sessionId)),
        playedAt,
        fingerprint
      }
    };
  }

  function readOutbox() {
    const rows = readJson(OUTBOX_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function writeOutbox(rows) {
    return writeJson(OUTBOX_KEY, Array.isArray(rows) ? rows.slice(-MAX_OUTBOX) : []);
  }

  function readSent() {
    const rows = readJson(SENT_KEY, []);
    return new Set(Array.isArray(rows) ? rows : []);
  }

  function markSent(fingerprint) {
    const sent = Array.from(readSent());
    if (!sent.includes(fingerprint)) sent.push(fingerprint);
    writeJson(SENT_KEY, sent.slice(-500));
  }

  function enqueue(payload) {
    const key = payload && payload.record && payload.record.fingerprint;
    if (!key) return false;
    const sent = readSent();
    if (sent.has(key)) return false;
    const rows = readOutbox();
    if (rows.some((row) => row && row.record && row.record.fingerprint === key)) return false;
    rows.push(payload);
    writeOutbox(rows);
    return true;
  }

  async function post(payload) {
    const url = endpoint();
    if (!validEndpoint(url)) return { ok:false, reason:"endpoint_not_configured" };

    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      return { ok:true };
    } catch (err) {
      return { ok:false, reason:String(err && err.message || err) };
    }
  }

  let flushing = false;
  async function flush() {
    if (flushing) return { ok:false, reason:"already_flushing" };
    if (!validEndpoint(endpoint())) return { ok:false, reason:"endpoint_not_configured" };
    flushing = true;
    try {
      const rows = readOutbox();
      const pending = [];
      let sent = 0;
      for (const payload of rows) {
        const result = await post(payload);
        const fingerprint = payload && payload.record && payload.record.fingerprint;
        if (result.ok && fingerprint) {
          markSent(fingerprint);
          sent += 1;
        } else {
          pending.push(payload);
        }
      }
      writeOutbox(pending);
      window.EAP_WORD_CLOUD_SYNC_STATUS = {
        version: VERSION,
        endpointConfigured: true,
        queued: pending.length,
        sent,
        updatedAt: new Date().toISOString()
      };
      return { ok:true, queued:pending.length, sent };
    } finally {
      flushing = false;
    }
  }

  async function capture(result) {
    const payload = recordFrom(result);
    if (typeof window.logEapWordQuestResult === "function") {
      try { window.logEapWordQuestResult(payload.record); } catch (err) {}
    }
    enqueue(payload);
    return flush();
  }

  window.addEventListener("eap-core-run-finished", (event) => {
    const result = event && event.detail;
    if (result && result.sessionId) {
      setTimeout(() => capture(result), 80);
    }
  });

  window.addEventListener("online", () => { flush(); });
  [500,1500,4000].forEach((delay) => setTimeout(flush, delay));

  window.configureEapWordSheetEndpoint = (url) => {
    const clean = norm(url);
    if (!validEndpoint(clean)) return { ok:false, error:"A deployed Google Apps Script Web App URL is required." };
    window.EAP_WORD_SHEET_CONFIG = Object.assign({}, window.EAP_WORD_SHEET_CONFIG || {}, { endpoint:clean, group:GROUP });
    try { localStorage.setItem("EAP_WORD_SHEET_ENDPOINT", clean); } catch (err) {}
    flush();
    return { ok:true, endpoint:clean };
  };

  window.flushEapWordQuestCloudSync = flush;
  window.inspectEapWordQuestCloudSync = () => ({
    version: VERSION,
    endpoint: endpoint(),
    endpointConfigured: validEndpoint(endpoint()),
    queued: readOutbox().length,
    sentCount: readSent().size,
    status: window.EAP_WORD_CLOUD_SYNC_STATUS || null
  });

  console.info("[EAP Word Quest] v240 Core cloud sync ready", window.inspectEapWordQuestCloudSync());
})();
