/* =========================================================
   EAP Word Quest • Admin-only Test Identity Migration
   File: /herohealth/eap-word-quest/apps-script/EAPWordQuest_AdminMigration.gs

   Purpose
   Move one TEST learner record from an old ID/name to the corrected ID/name
   in the SAME Google Spreadsheet without adding any Web App route.

   Important
   - Run only from Apps Script editor by the teacher/admin.
   - Do NOT expose this through doGet() / doPost().
   - An audit row is written before data is changed.
========================================================= */

const EAPWQ_ADMIN_MIGRATION_AUDIT = 'eap_word_identity_audit';

/* One-time correction for the current test data shown in the dashboard.
   Old test identity: KK / 12
   Correct identity:  KP / 50 */
function migrateEapWordQuestTest_KK12_to_KP50() {
  return eapwqAdminMigrateIdentity_({
    fromStudentId: '12',
    fromStudentName: 'KK',
    toStudentId: '50',
    toStudentName: 'KP',
    group: '122',
    reason: 'Correct test identity KK/12 to KP/50'
  });
}

/* Reusable teacher-only helper. Edit the object values when a confirmed
   administrative correction is required. */
function eapwqAdminMigrateIdentity_(input) {
  const cfg = input || {};
  const fromId = String(cfg.fromStudentId || '').trim();
  const toId = String(cfg.toStudentId || '').trim();
  const fromName = String(cfg.fromStudentName || '').trim();
  const toName = String(cfg.toStudentName || '').trim();
  const group = String(cfg.group || '122').trim() || '122';

  if (!fromId || !toId || !toName) {
    throw new Error('fromStudentId, toStudentId and toStudentName are required.');
  }
  if (fromId === toId && (!fromName || fromName === toName)) {
    return { ok: true, changed: false, message: 'No migration is needed.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const audit = eapwqAdminAuditSheet_(ss);
  const targets = ['eap_word_profiles', 'eap_word_attempts', 'eap_word_summary'];
  const auditRows = [];
  const changedBySheet = {};

  targets.forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) {
      changedBySheet[sheetName] = 0;
      return;
    }

    const range = sh.getDataRange();
    const values = range.getValues();
    const headers = values[0].map(String);
    const idCol = headers.indexOf('studentId');
    const nameCol = headers.indexOf('studentName');
    const groupCol = headers.indexOf('group');
    const sectionCol = headers.indexOf('section');

    if (idCol < 0 || nameCol < 0) {
      changedBySheet[sheetName] = 0;
      return;
    }

    let changed = 0;
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      const rowId = String(row[idCol] == null ? '' : row[idCol]).trim();
      const rowName = String(row[nameCol] == null ? '' : row[nameCol]).trim();
      const rowGroup = groupCol >= 0
        ? String(row[groupCol] == null ? '' : row[groupCol]).trim()
        : (sectionCol >= 0 ? String(row[sectionCol] == null ? '' : row[sectionCol]).trim() : group);

      if (rowId !== fromId || (rowGroup && rowGroup !== group)) continue;
      if (fromName && rowName && rowName !== fromName) continue;

      auditRows.push([
        new Date(),
        sheetName,
        rowIndex + 1,
        group,
        fromId,
        rowName,
        toId,
        toName,
        String(cfg.reason || 'Administrative identity correction')
      ]);

      row[idCol] = toId;
      row[nameCol] = toName;
      if (groupCol >= 0) row[groupCol] = group;
      if (sectionCol >= 0) row[sectionCol] = group;
      changed += 1;
    }

    if (changed) {
      range.setValues(values);
      changedBySheet[sheetName] = changed;
    } else {
      changedBySheet[sheetName] = 0;
    }
  });

  eapwqAdminDeduplicateProfiles_(ss, group, toId, toName);
  eapwqAdminDeduplicateSummary_(ss, group, toId, toName);

  if (auditRows.length) {
    audit.getRange(audit.getLastRow() + 1, 1, auditRows.length, auditRows[0].length).setValues(auditRows);
  }

  return {
    ok: true,
    changed: auditRows.length > 0,
    from: { studentId: fromId, studentName: fromName || '(any)' },
    to: { studentId: toId, studentName: toName },
    group: group,
    changedBySheet: changedBySheet,
    auditRows: auditRows.length
  };
}

function eapwqAdminAuditSheet_(ss) {
  let sh = ss.getSheetByName(EAPWQ_ADMIN_MIGRATION_AUDIT);
  const headers = [
    'migratedAt','sheet','rowNumber','group',
    'fromStudentId','fromStudentName','toStudentId','toStudentName','reason'
  ];

  if (!sh) {
    sh = ss.insertSheet(EAPWQ_ADMIN_MIGRATION_AUDIT);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.autoResizeColumns(1, headers.length);
  }
  return sh;
}

function eapwqAdminDeduplicateProfiles_(ss, group, studentId, studentName) {
  const sh = ss.getSheetByName('eap_word_profiles');
  if (!sh || sh.getLastRow() < 2) return;

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const idCol = headers.indexOf('studentId');
  const nameCol = headers.indexOf('studentName');
  const groupCol = headers.indexOf('group');
  const matches = [];

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (String(row[idCol]).trim() !== studentId) continue;
    if (groupCol >= 0 && String(row[groupCol]).trim() !== group) continue;
    matches.push(i + 1);
  }

  if (!matches.length) return;
  const keep = matches[0];
  if (nameCol >= 0) sh.getRange(keep, nameCol + 1).setValue(studentName);

  matches.slice(1).reverse().forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });
}

function eapwqAdminDeduplicateSummary_(ss, group, studentId, studentName) {
  const sh = ss.getSheetByName('eap_word_summary');
  if (!sh || sh.getLastRow() < 2) return;

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const idCol = headers.indexOf('studentId');
  const nameCol = headers.indexOf('studentName');
  const groupCol = headers.indexOf('group');
  const sessionCol = headers.indexOf('sessionId');
  const bestAccCol = headers.indexOf('bestAccuracy');
  const bestScoreCol = headers.indexOf('bestScore');
  const attemptsCol = headers.indexOf('attempts');
  const passedCol = headers.indexOf('passed');
  const latestBySession = {};
  const deleteRows = [];

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (String(row[idCol]).trim() !== studentId) continue;
    if (groupCol >= 0 && String(row[groupCol]).trim() !== group) continue;

    const sessionId = String(row[sessionCol] || '').trim();
    if (!sessionId) continue;
    if (!latestBySession[sessionId]) {
      latestBySession[sessionId] = { rowNumber: i + 1, row: row };
      continue;
    }

    const keep = latestBySession[sessionId];
    const keepRow = keep.row;
    const acc = Math.max(Number(keepRow[bestAccCol]) || 0, Number(row[bestAccCol]) || 0);
    const score = Math.max(Number(keepRow[bestScoreCol]) || 0, Number(row[bestScoreCol]) || 0);
    const attempts = (Number(keepRow[attemptsCol]) || 0) + (Number(row[attemptsCol]) || 0);
    const passed = String(keepRow[passedCol]).toLowerCase() === 'true' || String(row[passedCol]).toLowerCase() === 'true';

    keepRow[bestAccCol] = acc;
    keepRow[bestScoreCol] = score;
    keepRow[attemptsCol] = attempts;
    keepRow[passedCol] = String(passed);
    if (nameCol >= 0) keepRow[nameCol] = studentName;
    deleteRows.push(i + 1);
  }

  Object.keys(latestBySession).forEach(function(sessionId) {
    const entry = latestBySession[sessionId];
    if (nameCol >= 0) entry.row[nameCol] = studentName;
    sh.getRange(entry.rowNumber, 1, 1, entry.row.length).setValues([entry.row]);
  });

  deleteRows.reverse().forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });
}
