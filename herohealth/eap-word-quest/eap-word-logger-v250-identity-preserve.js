/* =========================================================
   EAP Word Quest • Identity-Preserving Log Reader
   File: /herohealth/eap-word-quest/eap-word-logger-v250-identity-preserve.js
   Version: v2.5.0-IDENTITY-PRESERVE-122

   Fixes a legacy logger behavior that rebuilt old local records using the
   currently selected Student Profile. That could make a former learner's
   history appear under a new ID on the same device.

   Rules
   - Never overwrite a stored studentId/studentName while reading logs.
   - Ignore old stats-history rows that have no stored studentId.
   - Keep data separated by Group + Student ID.
   - Does not edit local logs and does not change any Google Sheets data.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.5.0-IDENTITY-PRESERVE-122";
  const GROUP = "122";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";

  if (window.__EAP_WORD_V250_IDENTITY_PRESERVE__) return;
  window.__EAP_WORD_V250_IDENTITY_PRESERVE__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function rowKey(row) {
    return norm(row.fingerprint) || [
      norm(row.group || row.section || GROUP),
      norm(row.studentId),
      norm(row.sessionId),
      norm(row.playedAt || row.endedAt || row.at),
      norm(row.correct),
      norm(row.total),
      norm(row.source)
    ].join("|");
  }

  function stableRow(raw) {
    const row = raw && typeof raw === "object" ? raw : {};
    const studentId = norm(row.studentId || row.id);
    const studentName = norm(row.studentName || row.name);
    const group = norm(row.group || row.section || GROUP) || GROUP;
    const sessionId = norm(row.sessionId || row.session || row.idSession);

    // Unidentified rows must never be assigned to whoever opened the page.
    if (!studentId || !sessionId) return null;

    return Object.assign({}, row, {
      group,
      section: norm(row.section || group) || group,
      studentId,
      studentName: studentName || "Unknown",
      studentKey: `${group}|${studentId}|${studentName || "Unknown"}`,
      weakWords: Array.isArray(row.weakWords) ? row.weakWords : (norm(row.weakWords) ? norm(row.weakWords).split(/[|,;]/).map(norm).filter(Boolean) : []),
      itemTypeWeak: Array.isArray(row.itemTypeWeak) ? row.itemTypeWeak : (norm(row.itemTypeWeak) ? norm(row.itemTypeWeak).split(/[|,;]/).map(norm).filter(Boolean) : []),
      levelWeak: Array.isArray(row.levelWeak) ? row.levelWeak : (norm(row.levelWeak) ? norm(row.levelWeak).split(/[|,;]/).map(norm).filter(Boolean) : [])
    });
  }

  function readStableLogs() {
    const raw = readJson(LOG_KEY, []);
    const map = new Map();

    (Array.isArray(raw) ? raw : []).forEach((row) => {
      const stable = stableRow(row);
      if (!stable) return;
      map.set(rowKey(stable), stable);
    });

    return Array.from(map.values()).sort((a, b) =>
      new Date(a.playedAt || a.endedAt || 0).getTime() - new Date(b.playedAt || b.endedAt || 0).getTime()
    );
  }

  function downloadStableCsv() {
    const rows = readStableLogs();
    if (typeof window.eapWordQuestLogsToCsv !== "function") return { count: rows.length };
    const csv = window.eapWordQuestLogsToCsv(rows);
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eap-word-quest-group122-learning-logs-${date}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => { URL.revokeObjectURL(url); anchor.remove(); }, 300);
    return { count: rows.length, filename: anchor.download };
  }

  window.readEapWordQuestLogs = readStableLogs;
  window.downloadEapWordQuestLogsCsv = downloadStableCsv;
  window.inspectEapWordQuestIdentityLogs = () => {
    const rows = readStableLogs();
    const byId = {};
    rows.forEach((row) => {
      const key = `${row.studentName} / ${row.studentId}`;
      byId[key] = (byId[key] || 0) + 1;
    });
    return { version: VERSION, count: rows.length, byIdentity: byId };
  };

  console.info("[EAP Word Quest] v250 identity-preserving log reader ready", window.inspectEapWordQuestIdentityLogs());
})();
