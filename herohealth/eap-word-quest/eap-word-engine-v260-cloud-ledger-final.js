/* =========================================================
   EAP Word Quest • Cloud Ledger Final
   File: /herohealth/eap-word-quest/eap-word-engine-v260-cloud-ledger-final.js
   Version: v2.6.0-CLOUD-LEDGER-FINAL-122

   Guarantees
   - Sends every completed S1–S15 / BG1–BG5 attempt to Google Sheets.
   - Replays unsent local history once a valid endpoint is available.
   - Uses stable fingerprints so retries and backfill cannot create duplicates.
   - Keeps all analytics local-first when a learner is offline.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.0-CLOUD-LEDGER-FINAL-122";
  const GROUP = "122";
  const FLOW = new Set([
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);
  const OUTBOX_KEY = "EAP_WORD_QUEST_SHEET_OUTBOX_V260";
  const SENT_KEY = "EAP_WORD_QUEST_SHEET_SENT_V260";
  const MAX_OUTBOX = 600;
  const MAX_SENT = 1800;
  const BATCH_SIZE = 10;

  if (window.__EAP_WORD_V260_CLOUD_LEDGER__) return;
  window.__EAP_WORD_V260_CLOUD_LEDGER__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bool = (value) => value === true || value === 1 || String(value).toLowerCase() === "true";
  const arr = (value) => Array.isArray(value)
    ? value.map(norm).filter(Boolean)
    : typeof value === "string"
      ? value.split(/[|,;]/).map(norm).filter(Boolean)
      : [];

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
      console.warn("[EAP Word Quest] cloud-ledger storage skipped", err);
      return false;
    }
  }

  function endpoint() {
    const helper = typeof window.getEapWordSheetEndpoint === "function"
      ? window.getEapWordSheetEndpoint()
      : "";
    const config = window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint;
    const saved = (() => {
      try { return localStorage.getItem("EAP_WORD_SHEET_ENDPOINT") || ""; }
      catch (err) { return ""; }
    })();
    return norm(helper || config || saved);
  }

  function validEndpoint(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(norm(url));
  }

  function validIdentity(studentId, studentName) {
    const id = norm(studentId).toLowerCase();
    const name = norm(studentName).toLowerCase();
    return Boolean(id && name) &&
      !["anon", "no-id", "unknown"].includes(id) &&
      !["anonymous", "unknown"].includes(name);
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    if (/^BG/.test(sessionId)) return 70;
    return 60;
  }

  function fingerprintFrom(record) {
    return [
      GROUP,
      norm(record.studentId),
      norm(record.studentName).toLowerCase(),
      norm(record.sessionId).toUpperCase(),
      Math.round(num(record.correct)),
      Math.round(num(record.total)),
      Math.round(num(record.accuracy)),
      norm(record.playedAt).slice(0, 19)
    ].join("|");
  }

  function normalizeRecord(input) {
    const source = input && typeof input === "object" ? input : {};
    const sessionId = norm(source.sessionId || source.session || source.id).toUpperCase();
    if (!FLOW.has(sessionId)) return null;

    const studentId = norm(source.studentId || source.idNumber || source.studentCode);
    const studentName = norm(source.studentName || source.name);
    if (!validIdentity(studentId, studentName)) return null;

    const correct = Math.max(0, Math.round(num(source.correct)));
    const total = Math.max(1, Math.round(num(source.total || source.questions, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(source.accuracy, (correct / total) * 100))));
    const playedAt = norm(source.playedAt || source.endedAt || source.at || source.updatedAt || new Date().toISOString());
    const passThreshold = Math.max(0, Math.round(num(source.passThreshold, threshold(sessionId))));

    const record = {
      logVersion: norm(source.logVersion || VERSION),
      source: norm(source.source || "student-core"),
      course: norm(source.course || "EAP"),
      game: norm(source.game || "EAP Word Quest"),
      role: norm(source.role || "Vocabulary Side Quest"),
      mainGame: norm(source.mainGame || "EAP Hero Save the Society"),
      group: GROUP,
      section: GROUP,
      studentName,
      studentId,
      arcId: norm(source.arcId),
      arc: norm(source.arc),
      sessionId,
      sessionTitle: norm(source.sessionTitle || sessionId),
      sessionType: norm(source.sessionType || (/^BG/.test(sessionId) ? "boss" : "session")),
      correct,
      total,
      accuracy,
      xp: Math.max(0, Math.round(num(source.xp, source.score))),
      score: Math.max(0, Math.round(num(source.score, source.xp))),
      maxCombo: Math.max(0, Math.round(num(source.maxCombo || source.combo))),
      passed: bool(source.passed) || accuracy >= passThreshold,
      passThreshold,
      passStatus: norm(source.passStatus),
      cefrLevel: norm(source.cefrLevel || source.level),
      aiDifficulty: norm(source.aiDifficulty),
      aiPrediction: norm(source.aiPrediction),
      hintUsed: Math.max(0, Math.round(num(source.hintUsed || source.hintsUsed))),
      weakWords: arr(source.weakWords || source.weak || source.weakWord),
      itemTypeWeak: arr(source.itemTypeWeak),
      levelWeak: arr(source.levelWeak),
      responseTimeAvg: Math.max(0, num(source.responseTimeAvg)),
      attempt: Math.max(1, Math.round(num(source.attempt, 1))),
      bossHp: Math.max(0, Math.round(num(source.bossHp))),
      bossMaxHp: Math.max(0, Math.round(num(source.bossMaxHp))),
      isBoss: bool(source.isBoss) || /^BG/.test(sessionId),
      playedAt
    };

    record.fingerprint = norm(source.fingerprint) || fingerprintFrom(record);
    return record;
  }

  function envelopeFrom(input) {
    const record = normalizeRecord(input);
    if (!record) return null;
    return {
      action: "eap_word_attempt",
      schemaVersion: VERSION,
      clientTs: record.playedAt,
      pageUrl: location.href,
      userAgent: navigator.userAgent || "",
      record
    };
  }

  function readOutbox() {
    const rows = readJson(OUTBOX_KEY, []);
    return Array.isArray(rows) ? rows.filter((row) => row && row.record && row.record.fingerprint) : [];
  }

  function writeOutbox(rows) {
    return writeJson(OUTBOX_KEY, (Array.isArray(rows) ? rows : []).slice(-MAX_OUTBOX));
  }

  function readSent() {
    const rows = readJson(SENT_KEY, []);
    return new Set(Array.isArray(rows) ? rows.map(norm).filter(Boolean) : []);
  }

  function markSent(fingerprints) {
    const sent = Array.from(readSent());
    (Array.isArray(fingerprints) ? fingerprints : [fingerprints]).forEach((value) => {
      const key = norm(value);
      if (key && !sent.includes(key)) sent.push(key);
    });
    writeJson(SENT_KEY, sent.slice(-MAX_SENT));
  }

  function enqueue(payload) {
    const fingerprint = norm(payload && payload.record && payload.record.fingerprint);
    if (!fingerprint) return false;
    if (readSent().has(fingerprint)) return false;

    const rows = readOutbox();
    if (rows.some((row) => norm(row && row.record && row.record.fingerprint) === fingerprint)) return false;
    rows.push(payload);
    writeOutbox(rows);
    return true;
  }

  async function postBatch(chunk) {
    const url = endpoint();
    if (!validEndpoint(url)) return { ok:false, reason:"endpoint_not_configured" };

    const records = chunk.map((row) => row.record).filter(Boolean);
    if (!records.length) return { ok:true, sent:0 };

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
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      return { ok:true, sent:records.length };
    } catch (err) {
      return { ok:false, reason:String(err && err.message || err) };
    }
  }

  let flushing = false;
  function emitStatus(extra) {
    window.EAP_WORD_CLOUD_SYNC_STATUS = Object.assign({
      version: VERSION,
      endpoint: endpoint(),
      endpointConfigured: validEndpoint(endpoint()),
      queued: readOutbox().length,
      sentCount: readSent().size,
      updatedAt: new Date().toISOString()
    }, extra || {});
    window.dispatchEvent(new CustomEvent("eap-word-cloud-ledger-status", {
      detail: window.EAP_WORD_CLOUD_SYNC_STATUS
    }));
  }

  async function flush(reason) {
    if (flushing) return { ok:false, reason:"already_flushing" };
    if (!validEndpoint(endpoint())) {
      emitStatus({ ok:false, reason:"endpoint_not_configured" });
      return { ok:false, reason:"endpoint_not_configured" };
    }

    flushing = true;
    try {
      let pending = readOutbox();
      let sent = 0;
      let failure = "";

      while (pending.length) {
        const chunk = pending.slice(0, BATCH_SIZE);
        const result = await postBatch(chunk);
        if (!result.ok) {
          failure = result.reason || "post_failed";
          break;
        }
        const fingerprints = chunk.map((row) => norm(row.record && row.record.fingerprint)).filter(Boolean);
        markSent(fingerprints);
        sent += fingerprints.length;
        pending = pending.slice(chunk.length);
      }

      writeOutbox(pending);
      emitStatus({ ok:!failure, reason:failure || reason || "flushed", sent, queued:pending.length });
      return { ok:!failure, sent, queued:pending.length, reason:failure || reason || "flushed" };
    } finally {
      flushing = false;
    }
  }

  function localLedgerRows() {
    try {
      const rows = typeof window.readEapWordQuestLogs === "function"
        ? window.readEapWordQuestLogs()
        : [];
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return [];
    }
  }

  async function backfillLocalLedger(reason) {
    const rows = localLedgerRows();
    let added = 0;
    let skipped = 0;

    rows.forEach((row) => {
      const payload = envelopeFrom(row);
      if (!payload) {
        skipped += 1;
        return;
      }
      if (enqueue(payload)) added += 1;
    });

    const result = await flush(reason || "local_ledger_backfill");
    emitStatus(Object.assign({}, result, {
      backfillRows: rows.length,
      backfillQueued: added,
      backfillSkipped: skipped
    }));
    return Object.assign({}, result, { rows:rows.length, queued:added, skipped });
  }

  async function capture(result) {
    const payload = envelopeFrom(result);
    if (!payload) return { ok:false, reason:"invalid_result_or_profile" };

    if (typeof window.logEapWordQuestResult === "function") {
      try { window.logEapWordQuestResult(payload.record); } catch (err) {}
    }

    const queued = enqueue(payload);
    const resultState = await flush("completed_round");
    return Object.assign({}, resultState, { queued, fingerprint:payload.record.fingerprint });
  }

  window.addEventListener("eap-core-run-finished", (event) => {
    const result = event && event.detail;
    if (result && result.sessionId) setTimeout(() => capture(result), 80);
  });

  window.addEventListener("online", () => {
    backfillLocalLedger("network_restored");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") backfillLocalLedger("page_visible");
  });

  [600, 1600, 4200].forEach((delay) => {
    setTimeout(() => backfillLocalLedger("startup_backfill"), delay);
  });

  window.configureEapWordSheetEndpoint = (url) => {
    const clean = norm(url);
    if (!validEndpoint(clean)) {
      return { ok:false, error:"A deployed Google Apps Script /exec URL is required." };
    }
    window.EAP_WORD_SHEET_CONFIG = Object.assign({}, window.EAP_WORD_SHEET_CONFIG || {}, {
      endpoint: clean,
      group: GROUP
    });
    try { localStorage.setItem("EAP_WORD_SHEET_ENDPOINT", clean); } catch (err) {}
    backfillLocalLedger("endpoint_configured");
    return { ok:true, endpoint:clean };
  };

  window.flushEapWordQuestCloudSync = () => flush("manual_flush");
  window.backfillEapWordQuestCloudLedger = () => backfillLocalLedger("manual_backfill");
  window.inspectEapWordQuestCloudSync = () => ({
    version: VERSION,
    endpoint: endpoint(),
    endpointConfigured: validEndpoint(endpoint()),
    queued: readOutbox().length,
    sentCount: readSent().size,
    status: window.EAP_WORD_CLOUD_SYNC_STATUS || null
  });

  emitStatus({ ok:true, reason:"ready" });
  console.info("[EAP Word Quest] cloud ledger final ready", window.inspectEapWordQuestCloudSync());
})();
