// /herohealth/goodjunk-intervention/research/localstore.js
// Shared localStorage helper for GoodJunk intervention

(function () {
  'use strict';

  const WIN = window;
  const CFG = WIN.GJ_INT_CONFIG;

  if (!CFG) {
    console.warn('[GJ localstore] Missing GJ_INT_CONFIG');
    return;
  }

  if (WIN.GJ_INT_LOCALSTORE) return;

  const LIMITS = {
    sessions: 300,
    events: 3000,
    ml: 1200,
    mlGameend: 300,
    genericRows: 500
  };

  function readJson(key, fallback = null) {
    return CFG.utils.readJson(key, fallback);
  }

  function writeJson(key, value) {
    return CFG.utils.writeJson(key, value);
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  function appendRow(key, row, limit = LIMITS.genericRows) {
    const rows = Array.isArray(readJson(key, [])) ? readJson(key, []) : [];
    rows.push(row);

    if (Number.isFinite(limit) && limit > 0 && rows.length > limit) {
      rows.splice(0, rows.length - limit);
    }

    writeJson(key, rows);
    return rows;
  }

  function replaceRows(key, rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    writeJson(key, safeRows);
    return safeRows;
  }

  function loadRows(key) {
    const rows = readJson(key, []);
    return Array.isArray(rows) ? rows : [];
  }

  function clearRows(key) {
    return remove(key);
  }

  function upsertLatest(key, row) {
    writeJson(key, row);
    return row;
  }

  function exportJsonString(key, pretty = true) {
    const data = readJson(key, null);
    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  function csvEscape(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function rowsToCsv(rows, preferredColumns) {
    const xs = Array.isArray(rows) ? rows : [];
    if (!xs.length) return '';

    const cols = Array.isArray(preferredColumns) && preferredColumns.length
      ? preferredColumns
      : Array.from(xs.reduce((set, row) => {
          Object.keys(row || {}).forEach(k => set.add(k));
          return set;
        }, new Set()));

    const lines = [
      cols.map(csvEscape).join(',')
    ];

    xs.forEach((row) => {
      lines.push(cols.map(c => csvEscape(row?.[c] ?? '')).join(','));
    });

    return lines.join('\n');
  }

  function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportRowsAsJsonFile(key, filename = 'export.json') {
    const text = exportJsonString(key, true);
    downloadText(filename, text, 'application/json;charset=utf-8');
  }

  function exportRowsAsCsvFile(key, filename = 'export.csv', preferredColumns) {
    const rows = loadRows(key);
    const csv = rowsToCsv(rows, preferredColumns);
    downloadText(filename, csv, 'text/csv;charset=utf-8');
  }

  /* ----------- keyed helpers by schema type ----------- */

  function saveLatestGameSummary(row) {
    return upsertLatest(CFG.storageKeys.latestGameSummary, row);
  }

  function loadLatestGameSummary() {
    return readJson(CFG.storageKeys.latestGameSummary, null);
  }

  function appendSessionRow(row) {
    return appendRow(CFG.storageKeys.sessionsHistory, row, LIMITS.sessions);
  }

  function loadSessionRows() {
    return loadRows(CFG.storageKeys.sessionsHistory);
  }

  function clearSessionRows() {
    return clearRows(CFG.storageKeys.sessionsHistory);
  }

  function appendEventRow(row) {
    return appendRow(CFG.storageKeys.eventsHistory, row, LIMITS.events);
  }

  function loadEventRows() {
    return loadRows(CFG.storageKeys.eventsHistory);
  }

  function clearEventRows() {
    return clearRows(CFG.storageKeys.eventsHistory);
  }

  function appendMlRow(row) {
    return appendRow(CFG.storageKeys.mlHistory, row, LIMITS.ml);
  }

  function loadMlRows() {
    return loadRows(CFG.storageKeys.mlHistory);
  }

  function clearMlRows() {
    return clearRows(CFG.storageKeys.mlHistory);
  }

  function appendMlGameendRow(row) {
    return appendRow(CFG.storageKeys.mlGameendHistory, row, LIMITS.mlGameend);
  }

  function loadMlGameendRows() {
    return loadRows(CFG.storageKeys.mlGameendHistory);
  }

  function clearMlGameendRows() {
    return clearRows(CFG.storageKeys.mlGameendHistory);
  }

  /* ----------- simple debug snapshot ----------- */

  function dumpAllKnown() {
    return {
      teacherPanel: readJson(CFG.storageKeys.teacherPanel, null),

      preKnowledge: readJson(CFG.storageKeys.preKnowledge, null),
      postKnowledge: readJson(CFG.storageKeys.postKnowledge, null),

      preBehavior: readJson(CFG.storageKeys.preBehavior, null),
      postBehavior: readJson(CFG.storageKeys.postBehavior, null),

      parentQuestionnaire: readJson(CFG.storageKeys.parentQuestionnaire, null),
      weeklyCheck: readJson(CFG.storageKeys.weeklyCheck, null),
      shortFollowup: readJson(CFG.storageKeys.shortFollowup, null),

      latestGameSummary: readJson(CFG.storageKeys.latestGameSummary, null),
      sessionsHistory: loadRows(CFG.storageKeys.sessionsHistory),
      eventsHistory: loadRows(CFG.storageKeys.eventsHistory),
      mlHistory: loadRows(CFG.storageKeys.mlHistory),
      mlGameendHistory: loadRows(CFG.storageKeys.mlGameendHistory)
    };
  }

  WIN.GJ_INT_LOCALSTORE = {
    LIMITS,

    readJson,
    writeJson,
    remove,

    appendRow,
    replaceRows,
    loadRows,
    clearRows,

    upsertLatest,

    csvEscape,
    rowsToCsv,

    downloadText,
    exportJsonString,
    exportRowsAsJsonFile,
    exportRowsAsCsvFile,

    saveLatestGameSummary,
    loadLatestGameSummary,

    appendSessionRow,
    loadSessionRows,
    clearSessionRows,

    appendEventRow,
    loadEventRows,
    clearEventRows,

    appendMlRow,
    loadMlRows,
    clearMlRows,

    appendMlGameendRow,
    loadMlGameendRows,
    clearMlGameendRows,

    dumpAllKnown
  };
})();