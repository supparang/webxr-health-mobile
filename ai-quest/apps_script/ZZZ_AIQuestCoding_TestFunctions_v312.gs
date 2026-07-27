/**
 * CSAI2102 Coding Status v3.1.3 — Explicit Apps Script test/recovery functions
 *
 * Add this file AFTER:
 * 1) AIQuestCoding_Receiver.gs
 * 2) ZZ_AIQuestCoding_StatusRepair_v312.gs
 *
 * Explicit declarations are used so functions appear in the Apps Script
 * function selector at the top of the editor.
 */

function TEST_AIQCODING_S2_KK_V312() {
  if (typeof AIQCODING === 'undefined') {
    throw new Error('AIQCODING_MODULE_MISSING');
  }

  if (typeof AIQCODING.auditStatus_ !== 'function') {
    throw new Error(
      'AIQCODING_STATUS_REPAIR_MISSING: เพิ่มไฟล์ ZZ_AIQuestCoding_StatusRepair_v312.gs ก่อน'
    );
  }

  var result = AIQCODING.auditStatus_({
    studentId: '12',
    studentName: 'KK',
    section: '101',
    sessionId: 'S2'
  });

  Logger.log(JSON.stringify(result));
  return result;
}

function TEST_AIQCODING_CUSTOM_V312() {
  if (typeof AIQCODING === 'undefined' || typeof AIQCODING.auditStatus_ !== 'function') {
    throw new Error(
      'AIQCODING_STATUS_REPAIR_MISSING: เพิ่ม AIQuestCoding_Receiver.gs และ ZZ_AIQuestCoding_StatusRepair_v312.gs ก่อน'
    );
  }

  var studentId = '12';
  var studentName = 'KK';
  var section = '101';
  var sessionId = 'S2';

  var result = AIQCODING.auditStatus_({
    studentId: studentId,
    studentName: studentName,
    section: section,
    sessionId: sessionId
  });

  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * One-time recovery for the documented test account 12 / KK / Section 101 / S2.
 *
 * Use only because the earlier browser showed "ส่ง Coding Lab สำเร็จ" but the old
 * deployment did not persist the row. The recovery row is explicitly labelled
 * and is idempotent: it will not add another row when S2 is already completed.
 */
function REPAIR_TEST_KK_S2_CODING_V313() {
  if (typeof AIQCODING === 'undefined') {
    throw new Error('AIQCODING_MODULE_MISSING');
  }
  if (typeof AIQCODING.auditStatus_ !== 'function') {
    throw new Error('AIQCODING_STATUS_REPAIR_MISSING');
  }

  var identity = {
    studentId: '12',
    studentName: 'KK',
    section: '101',
    sessionId: 'S2'
  };

  var before = AIQCODING.auditStatus_(identity);
  if (before && before.completed === true) {
    Logger.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: 'S2_ALREADY_COMPLETED',
      status: before
    }));
    return {
      ok: true,
      skipped: true,
      reason: 'S2_ALREADY_COMPLETED',
      status: before
    };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SPREADSHEET_NOT_FOUND');

  var sheetName = 'coding_attempts';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var headers = [
    'submitted_at','coding_attempt_id','student_id','student_name','section','session_id',
    'attempt_number','prediction_answer','prediction_reason','prediction_correct',
    'run_score','modify_score','challenge_score','quiz_score','coding_score','completed',
    'run_count','error_count','error_types_json','output','completed_code','modified_code',
    'challenge_code','challenge_level','validation_mode','used_time_sec','version'
  ];

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    var lastCol = Math.max(1, sh.getLastColumn());
    var existing = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
      .map(function(v) { return String(v || '').trim(); });
    var missing = headers.filter(function(h) { return existing.indexOf(h) < 0; });
    if (missing.length) {
      sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    }
  }

  var finalHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0]
    .map(function(v) { return String(v || '').trim(); });

  var now = Utilities.formatDate(
    new Date(),
    'Asia/Bangkok',
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );

  var recoveryId = 'recovery_12_101_S2_20260727';
  var recovery = {
    submitted_at: now,
    coding_attempt_id: recoveryId,
    student_id: '12',
    student_name: 'KK',
    section: '101',
    session_id: 'S2',
    attempt_number: 1,
    prediction_answer: '[RECOVERED TEST RECORD]',
    prediction_reason: 'Recovered from documented browser submission that reported success before persistence verification.',
    prediction_correct: true,
    run_score: 25,
    modify_score: 35,
    challenge_score: 20,
    quiz_score: 5,
    coding_score: 100,
    completed: true,
    run_count: 1,
    error_count: 0,
    error_types_json: '[]',
    output: '[RECOVERED TEST RECORD]',
    completed_code: '[RECOVERED TEST RECORD]',
    modified_code: '[RECOVERED TEST RECORD]',
    challenge_code: '[RECOVERED TEST RECORD]',
    challenge_level: 'Recovery',
    validation_mode: 'MANUAL_TEST_RECOVERY_WITH_AUDIT_TRAIL',
    used_time_sec: 0,
    version: '20260727-AIQ-CODING-RECOVERY-V3.1.3'
  };

  var idCol = finalHeaders.indexOf('coding_attempt_id') + 1;
  var duplicate = false;
  if (idCol > 0 && sh.getLastRow() >= 2) {
    duplicate = !!sh.getRange(2, idCol, sh.getLastRow() - 1, 1)
      .createTextFinder(recoveryId)
      .matchEntireCell(true)
      .findNext();
  }

  if (!duplicate) {
    sh.appendRow(finalHeaders.map(function(h) {
      return recovery[h] === undefined ? '' : recovery[h];
    }));
    SpreadsheetApp.flush();
  }

  var after = AIQCODING.auditStatus_(identity);
  var result = {
    ok: after && after.completed === true,
    recovered: !duplicate,
    duplicate: duplicate,
    recoveryId: recoveryId,
    before: before,
    after: after
  };

  Logger.log(JSON.stringify(result));
  if (!result.ok) {
    throw new Error('RECOVERY_WRITE_NOT_VERIFIED: ' + JSON.stringify(result));
  }
  return result;
}

function VERIFY_TEST_KK_S2_AFTER_RECOVERY_V313() {
  if (typeof AIQCODING === 'undefined' || typeof AIQCODING.auditStatus_ !== 'function') {
    throw new Error('AIQCODING_STATUS_REPAIR_MISSING');
  }

  var result = AIQCODING.auditStatus_({
    studentId: '12',
    studentName: 'KK',
    section: '101',
    sessionId: 'S2'
  });

  Logger.log(JSON.stringify(result));
  if (!result || result.completed !== true) {
    throw new Error('S2_RECOVERY_NOT_CONFIRMED: ' + JSON.stringify(result));
  }
  return result;
}
