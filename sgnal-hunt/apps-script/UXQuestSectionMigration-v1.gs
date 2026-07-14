/* =========================================================
 * UX Quest • Historical Section Migration v1.1
 * Corrects historical UXQuest_Attempts rows saved under a wrong section.
 * Google Sheet remains the authoritative source of truth.
 *
 * Safety:
 * - Filters by studentId + old section + courseId.
 * - Creates a hidden backup sheet before changing data.
 * - Provides preview functions before apply.
 * ========================================================= */

/* ---------- Student 50: 101 -> 201 ---------- */
function UXQ_previewSectionMigration_50_101_to_201() {
  return UXQ_previewSectionMigration_({
    studentId: '50',
    fromSection: '101',
    toSection: '201',
    courseId: 'UXQ-ACT1-2026'
  });
}

function UXQ_applySectionMigration_50_101_to_201() {
  return UXQ_applySectionMigration_({
    studentId: '50',
    fromSection: '101',
    toSection: '201',
    courseId: 'UXQ-ACT1-2026'
  });
}

/* ---------- Student 3 (Kata): 101 -> 201 ---------- */
function UXQ_previewSectionMigration_3_101_to_201() {
  return UXQ_previewSectionMigration_({
    studentId: '3',
    fromSection: '101',
    toSection: '201',
    courseId: 'UXQ-ACT1-2026'
  });
}

function UXQ_applySectionMigration_3_101_to_201() {
  return UXQ_applySectionMigration_({
    studentId: '3',
    fromSection: '101',
    toSection: '201',
    courseId: 'UXQ-ACT1-2026'
  });
}

function UXQ_previewSectionMigration_(options) {
  const ctx = UXQ_sectionMigrationContext_(options);
  const matches = [];

  for (let r = 1; r < ctx.values.length; r += 1) {
    const row = ctx.values[r];
    const studentId = UXQ_migrateIdentity_(row[ctx.col.studentid]);
    const section = UXQ_migrateIdentity_(row[ctx.col.section]);
    const courseId = ctx.col.courseid === undefined ? '' : String(row[ctx.col.courseid] || '').trim();

    if (studentId !== ctx.options.studentId) continue;
    if (section !== ctx.options.fromSection) continue;
    if (courseId && courseId !== ctx.options.courseId) continue;

    matches.push({
      rowNumber: r + 1,
      studentId: studentId,
      studentName: ctx.col.studentname === undefined ? '' : String(row[ctx.col.studentname] || '').trim(),
      section: section,
      courseId: courseId,
      missionId: ctx.col.missionid === undefined ? '' : String(row[ctx.col.missionid] || '').trim(),
      eventType: ctx.col.eventtype === undefined ? '' : String(row[ctx.col.eventtype] || '').trim()
    });
  }

  const result = {
    ok: true,
    mode: 'preview',
    sheetName: ctx.sheet.getName(),
    studentId: ctx.options.studentId,
    fromSection: ctx.options.fromSection,
    toSection: ctx.options.toSection,
    courseId: ctx.options.courseId,
    matchedRows: matches.length,
    rows: matches.slice(0, 100)
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function UXQ_applySectionMigration_(options) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ctx = UXQ_sectionMigrationContext_(options);
    const preview = UXQ_previewSectionMigration_(options);
    if (!preview.matchedRows) {
      return {
        ok: true,
        mode: 'apply',
        changedRows: 0,
        message: 'ไม่พบแถวที่ต้องแก้',
        studentId: ctx.options.studentId,
        fromSection: ctx.options.fromSection,
        toSection: ctx.options.toSection
      };
    }

    const backupName = 'UXQuest_Attempts_backup_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
    const backup = ctx.sheet.copyTo(ctx.ss).setName(backupName);
    backup.hideSheet();

    const changedRows = [];
    for (let r = 1; r < ctx.values.length; r += 1) {
      const row = ctx.values[r];
      const studentId = UXQ_migrateIdentity_(row[ctx.col.studentid]);
      const section = UXQ_migrateIdentity_(row[ctx.col.section]);
      const courseId = ctx.col.courseid === undefined ? '' : String(row[ctx.col.courseid] || '').trim();

      if (studentId !== ctx.options.studentId) continue;
      if (section !== ctx.options.fromSection) continue;
      if (courseId && courseId !== ctx.options.courseId) continue;

      row[ctx.col.section] = ctx.options.toSection;
      changedRows.push(r + 1);
    }

    if (changedRows.length) {
      ctx.sheet.getRange(2, 1, ctx.values.length - 1, ctx.values[0].length)
        .setValues(ctx.values.slice(1));
      SpreadsheetApp.flush();
    }

    const result = {
      ok: true,
      mode: 'apply',
      sheetName: ctx.sheet.getName(),
      backupSheet: backupName,
      studentId: ctx.options.studentId,
      fromSection: ctx.options.fromSection,
      toSection: ctx.options.toSection,
      courseId: ctx.options.courseId,
      changedRows: changedRows.length,
      rowNumbers: changedRows
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function UXQ_sectionMigrationContext_(options) {
  const normalized = {
    studentId: UXQ_migrateIdentity_(options && options.studentId),
    fromSection: UXQ_migrateIdentity_(options && options.fromSection),
    toSection: UXQ_migrateIdentity_(options && options.toSection),
    courseId: String((options && options.courseId) || 'UXQ-ACT1-2026').trim()
  };

  if (!normalized.studentId || !normalized.fromSection || !normalized.toSection) {
    throw new Error('studentId, fromSection and toSection are required');
  }
  if (normalized.fromSection === normalized.toSection) {
    throw new Error('fromSection and toSection must be different');
  }

  const ss = UXQ_restoreSpreadsheetForMigration_();
  const sheet = ss.getSheetByName('UXQuest_Attempts');
  if (!sheet) throw new Error('ไม่พบชีต UXQuest_Attempts');
  if (sheet.getLastRow() < 2) throw new Error('UXQuest_Attempts ไม่มีข้อมูล');

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(UXQ_migrateKey_);
  const col = {};
  headers.forEach(function(key, index) {
    if (key && col[key] === undefined) col[key] = index;
  });

  ['studentid', 'section'].forEach(function(required) {
    if (col[required] === undefined) throw new Error('ไม่พบคอลัมน์ ' + required);
  });

  return { ss:ss, sheet:sheet, values:values, col:col, options:normalized };
}

function UXQ_restoreSpreadsheetForMigration_() {
  let spreadsheetId = '';
  try {
    if (typeof UXQ_RECEIVER_SPREADSHEET_ID !== 'undefined' && UXQ_RECEIVER_SPREADSHEET_ID) {
      spreadsheetId = String(UXQ_RECEIVER_SPREADSHEET_ID).trim();
    }
  } catch (error) {}

  if (!spreadsheetId) {
    spreadsheetId = String(
      PropertiesService.getScriptProperties().getProperty('UXQ_RECEIVER_SPREADSHEET_ID') || ''
    ).trim();
  }

  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('ไม่พบ Spreadsheet สำหรับ migration');
}

function UXQ_migrateIdentity_(value) {
  let text = String(value == null ? '' : value).trim();
  if (/^\d+\.0+$/.test(text)) text = text.replace(/\.0+$/, '');
  return text;
}

function UXQ_migrateKey_(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, '');
}
