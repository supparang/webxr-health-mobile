/**
 * CSAI2102 Coding Status v3.1.2 — Explicit Apps Script test functions
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
