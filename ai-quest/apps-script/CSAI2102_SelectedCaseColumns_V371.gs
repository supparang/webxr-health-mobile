/* =========================================================
   CSAI2102 AI Quest — Selected Case Columns Patch v3.7.1
   Safe supplemental Apps Script file.

   Purpose:
   - Add selected evidence case fields as real columns in session_attempts.
   - Backfill those fields from extraJson/raw payload without clearing existing data.
   - Safe to add beside existing Code.gs. Does NOT replace setupSheets().

   Usage in Apps Script:
   1) Add this file to the same Apps Script project as Code.gs.
   2) Run CSAI2102_SETUP_SELECTED_CASE_COLUMNS_V371 once.
   3) Run CSAI2102_BACKFILL_SELECTED_CASE_COLUMNS_V371 once after setup.
   4) Optional: run CSAI2102_INSTALL_SELECTED_CASE_BACKFILL_TRIGGER_V371
      to keep columns updated automatically.
========================================================= */

const CSAI2102_SELECTED_CASE_PATCH_V371 = 'v3.7.1-selected-case-columns';

const CSAI2102_ATTEMPTS_SHEET_V371 = 'session_attempts';

const CSAI2102_SELECTED_CASE_COLUMNS_V371 = [
  'selectedCaseId',
  'selectedCaseContext',
  'selectedCaseSkill',
  'selectedCaseRisk',
  'selectedCaseTrap',
  'reflectionPrompt1',
  'reflectionPrompt2',
  'reflectionPrompt3',
  'challengeLayer',
  'reflectionVersion',
  'rank',
  'nextMission'
];

function CSAI2102_SETUP_SELECTED_CASE_COLUMNS_V371() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CSAI2102_ATTEMPTS_SHEET_V371);
  if (!sh) throw new Error('Missing sheet: ' + CSAI2102_ATTEMPTS_SHEET_V371);

  const added = CSAI2102_ENSURE_COLUMNS_V371_(sh, CSAI2102_SELECTED_CASE_COLUMNS_V371);
  return {
    ok: true,
    patch: CSAI2102_SELECTED_CASE_PATCH_V371,
    sheet: CSAI2102_ATTEMPTS_SHEET_V371,
    addedColumns: added,
    message: added.length ? 'Added selected case columns safely.' : 'Columns already exist.'
  };
}

function CSAI2102_BACKFILL_SELECTED_CASE_COLUMNS_V371() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CSAI2102_ATTEMPTS_SHEET_V371);
  if (!sh) throw new Error('Missing sheet: ' + CSAI2102_ATTEMPTS_SHEET_V371);

  CSAI2102_ENSURE_COLUMNS_V371_(sh, CSAI2102_SELECTED_CASE_COLUMNS_V371);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) {
    return { ok: true, patch: CSAI2102_SELECTED_CASE_PATCH_V371, updatedRows: 0, message: 'No attempt rows yet.' };
  }

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const idx = function(name) { return headers.indexOf(name); };

  const extraIdx = idx('extraJson');
  if (extraIdx < 0) throw new Error('Missing extraJson column in session_attempts');

  const targetIndexes = {};
  CSAI2102_SELECTED_CASE_COLUMNS_V371.forEach(function(name) {
    targetIndexes[name] = idx(name);
  });

  let updatedRows = 0;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const extra = CSAI2102_PARSE_JSON_V371_(row[extraIdx]);
    const data = CSAI2102_EXTRACT_SELECTED_CASE_V371_(extra);

    if (!CSAI2102_HAS_SELECTED_CASE_DATA_V371_(data)) continue;

    let changed = false;
    CSAI2102_SELECTED_CASE_COLUMNS_V371.forEach(function(name) {
      const c = targetIndexes[name];
      if (c < 0) return;
      const next = data[name] || '';
      if (next && String(row[c] || '') !== String(next)) {
        row[c] = next;
        changed = true;
      }
    });

    if (changed) {
      updatedRows++;
      sh.getRange(r + 1, 1, 1, lastCol).setValues([row]);
    }
  }

  sh.autoResizeColumns(1, sh.getLastColumn());

  return {
    ok: true,
    patch: CSAI2102_SELECTED_CASE_PATCH_V371,
    updatedRows: updatedRows,
    message: 'Backfilled selected case columns from extraJson.'
  };
}

function CSAI2102_INSTALL_SELECTED_CASE_BACKFILL_TRIGGER_V371() {
  const fn = 'CSAI2102_BACKFILL_SELECTED_CASE_COLUMNS_V371';
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create();
  return { ok: true, patch: CSAI2102_SELECTED_CASE_PATCH_V371, trigger: fn, interval: 'every 5 minutes' };
}

function CSAI2102_UNINSTALL_SELECTED_CASE_BACKFILL_TRIGGER_V371() {
  const fn = 'CSAI2102_BACKFILL_SELECTED_CASE_COLUMNS_V371';
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === fn) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  return { ok: true, patch: CSAI2102_SELECTED_CASE_PATCH_V371, removed: removed };
}

function CSAI2102_ENSURE_COLUMNS_V371_(sh, columns) {
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  const added = [];

  columns.forEach(function(name) {
    if (headers.indexOf(name) >= 0) return;
    const newCol = sh.getLastColumn() + 1;
    sh.getRange(1, newCol).setValue(name);
    headers.push(name);
    added.push(name);
  });

  sh.setFrozenRows(1);
  if (added.length) sh.autoResizeColumns(1, sh.getLastColumn());
  return added;
}

function CSAI2102_PARSE_JSON_V371_(value) {
  if (!value) return {};
  if (typeof value === 'object') return value || {};
  const text = String(value || '').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch (e) { return {}; }
}

function CSAI2102_EXTRACT_SELECTED_CASE_V371_(extra) {
  extra = extra || {};

  // New v711/v712 payload is usually nested in extra.raw
  const raw = extra.raw || extra.payload || extra.attempt || {};
  const x = raw.extraJson || raw.extra || extra.extraJson || extra.extra || extra;

  return {
    selectedCaseId: CSAI2102_FIRST_TEXT_V371_(x.selectedCaseId, raw.selectedCaseId, extra.selectedCaseId),
    selectedCaseContext: CSAI2102_FIRST_TEXT_V371_(x.selectedCaseContext, raw.selectedCaseContext, extra.selectedCaseContext),
    selectedCaseSkill: CSAI2102_FIRST_TEXT_V371_(x.selectedCaseSkill, raw.selectedCaseSkill, extra.selectedCaseSkill, x.selectedCaseConcept, raw.selectedCaseConcept),
    selectedCaseRisk: CSAI2102_FIRST_TEXT_V371_(x.selectedCaseRisk, raw.selectedCaseRisk, extra.selectedCaseRisk),
    selectedCaseTrap: CSAI2102_FIRST_TEXT_V371_(x.selectedCaseTrap, raw.selectedCaseTrap, extra.selectedCaseTrap),
    reflectionPrompt1: CSAI2102_FIRST_TEXT_V371_(x.reflectionPrompt1, raw.reflectionPrompt1, extra.reflectionPrompt1),
    reflectionPrompt2: CSAI2102_FIRST_TEXT_V371_(x.reflectionPrompt2, raw.reflectionPrompt2, extra.reflectionPrompt2),
    reflectionPrompt3: CSAI2102_FIRST_TEXT_V371_(x.reflectionPrompt3, raw.reflectionPrompt3, extra.reflectionPrompt3),
    challengeLayer: CSAI2102_FIRST_TEXT_V371_(x.challengeLayer, raw.challengeLayer, extra.challengeLayer),
    reflectionVersion: CSAI2102_FIRST_TEXT_V371_(x.reflectionVersion, raw.reflectionVersion, extra.reflectionVersion),
    rank: CSAI2102_FIRST_TEXT_V371_(x.rank, raw.rank, extra.rank),
    nextMission: CSAI2102_FIRST_TEXT_V371_(x.nextMission, raw.nextMission, extra.nextMission)
  };
}

function CSAI2102_FIRST_TEXT_V371_() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v === null || v === undefined) continue;
    const s = String(v || '').trim();
    if (s) return s;
  }
  return '';
}

function CSAI2102_HAS_SELECTED_CASE_DATA_V371_(data) {
  return !!(
    data &&
    (data.selectedCaseContext || data.selectedCaseSkill || data.selectedCaseRisk || data.selectedCaseTrap ||
     data.reflectionPrompt1 || data.reflectionPrompt2 || data.reflectionPrompt3)
  );
}
