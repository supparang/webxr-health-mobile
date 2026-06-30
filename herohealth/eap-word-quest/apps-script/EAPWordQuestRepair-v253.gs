/* =========================================================
   EAP Word Quest • Confirmed Test Ledger Repair
   File: /herohealth/eap-word-quest/apps-script/EAPWordQuestRepair-v253.gs
   Version: v2.5.3-CONFIRMED-KK12-KP50-SHEETS-REPAIR

   Confirmed test fact for Group 122:
   - KK / 12 completed the old 20-mission route.
   - KP / 50 completed one real mission.

   This repairs ONLY legacy rows created by source:
     core-state-backfill-v243
   that were incorrectly stamped KP / 50 during shared-browser testing.

   Run order
   1) Run inspectEapWordQuestConfirmedKK12KP50Repair()
   2) Confirm the result shows the expected 20 legacy rows.
   3) Run applyEapWordQuestConfirmedKK12KP50Repair() ONCE.

   The script writes an audit sheet, then rebuilds summary rows from the
   corrected attempts. It does not delete any attempt rows.
========================================================= */

var EAPWQ_V253_REPAIR_VERSION = 'v2.5.3-CONFIRMED-KK12-KP50-SHEETS-REPAIR';
var EAPWQ_V253_REPAIR_GROUP = '122';
var EAPWQ_V253_REPAIR_SOURCE = 'core-state-backfill-v243';
var EAPWQ_V253_REPAIR_FROM_ID = '50';
var EAPWQ_V253_REPAIR_TO_ID = '12';
var EAPWQ_V253_REPAIR_TO_NAME = 'KK';
var EAPWQ_V253_REPAIR_AUDIT = 'eap_word_identity_repair_audit';
var EAPWQ_V253_REPAIR_FLOW = [
  'S1','S2','S3','BG1',
  'S4','S5','S6','BG2',
  'S7','S8','S9','BG3',
  'S10','S11','S12','BG4',
  'S13','S14','S15','BG5'
];

function inspectEapWordQuestConfirmedKK12KP50Repair() {
  setupEapWordQuest();
  var sh = eapwqSheet_(EAPWQ.attempts);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok:true, version:EAPWQ_V253_REPAIR_VERSION, matches:0, sessions:[] };

  var headers = values[0].map(String);
  var matches = [];
  values.slice(1).forEach(function(row, index) {
    if (eapwqV253IsTarget_(headers, row)) {
      matches.push({
        rowNumber:index + 2,
        sessionId:eapwqV253Cell_(headers, row, 'sessionId'),
        studentId:eapwqV253Cell_(headers, row, 'studentId'),
        studentName:eapwqV253Cell_(headers, row, 'studentName'),
        source:eapwqV253Cell_(headers, row, 'source'),
        playedAt:eapwqV253Cell_(headers, row, 'playedAt')
      });
    }
  });

  return {
    ok:true,
    version:EAPWQ_V253_REPAIR_VERSION,
    expected:20,
    matches:matches.length,
    sessions:matches.map(function(x) { return x.sessionId; }),
    rows:matches
  };
}

function applyEapWordQuestConfirmedKK12KP50Repair() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var inspection = inspectEapWordQuestConfirmedKK12KP50Repair();
    if (inspection.matches !== 20) {
      throw new Error('Safety stop: expected exactly 20 legacy rows for KK/12, found ' + inspection.matches + '. No data changed.');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var attempts = eapwqSheet_(EAPWQ.attempts);
    var values = attempts.getDataRange().getValues();
    var headers = values[0].map(String);
    var idCol = headers.indexOf('studentId');
    var nameCol = headers.indexOf('studentName');
    var sourceCol = headers.indexOf('source');
    var fpCol = headers.indexOf('fingerprint');
    var extraCol = headers.indexOf('extraJson');
    var sessionCol = headers.indexOf('sessionId');
    var auditRows = [];
    var stamp = eapwqNow_();

    for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      var row = values[rowIndex];
      if (!eapwqV253IsTarget_(headers, row)) continue;

      var oldId = eapwqV253Text_(row[idCol]);
      var oldName = eapwqV253Text_(row[nameCol]);
      var oldSource = eapwqV253Text_(row[sourceCol]);
      var oldFingerprint = eapwqV253Text_(row[fpCol]);
      var sessionId = eapwqV253Text_(row[sessionCol]).toUpperCase();
      var newFingerprint = 'v253-confirmed-kk12|' + EAPWQ_V253_REPAIR_GROUP + '|' + EAPWQ_V253_REPAIR_TO_ID + '|' + sessionId + '|' + oldFingerprint;

      auditRows.push([
        stamp, EAPWQ_V253_REPAIR_VERSION, rowIndex + 1,
        oldId, oldName, EAPWQ_V253_REPAIR_TO_ID, EAPWQ_V253_REPAIR_TO_NAME,
        sessionId, oldSource, 'teacher-confirmed-identity-repair-v253',
        oldFingerprint, newFingerprint
      ]);

      row[idCol] = EAPWQ_V253_REPAIR_TO_ID;
      row[nameCol] = EAPWQ_V253_REPAIR_TO_NAME;
      row[sourceCol] = 'teacher-confirmed-identity-repair-v253';
      row[fpCol] = newFingerprint;
      if (extraCol >= 0) {
        row[extraCol] = JSON.stringify({
          identityRepair:EAPWQ_V253_REPAIR_VERSION,
          confirmedOwner:{ studentId:EAPWQ_V253_REPAIR_TO_ID, studentName:EAPWQ_V253_REPAIR_TO_NAME },
          originalIdentity:{ studentId:oldId, studentName:oldName },
          originalSource:oldSource,
          originalFingerprint:oldFingerprint
        });
      }
    }

    attempts.getRange(1, 1, values.length, headers.length).setValues(values);
    eapwqV253WriteAudit_(ss, auditRows);
    eapwqV253RebuildProfilesAndSummary_(values[0], values.slice(1));
    SpreadsheetApp.flush();

    return {
      ok:true,
      version:EAPWQ_V253_REPAIR_VERSION,
      repairedRows:auditRows.length,
      confirmedOwner:EAPWQ_V253_REPAIR_TO_NAME + ' / ' + EAPWQ_V253_REPAIR_TO_ID,
      preservedStudent:'KP / 50',
      auditSheet:EAPWQ_V253_REPAIR_AUDIT,
      message:'Reassigned 20 legacy rows to KK/12 and rebuilt Sheets summary.'
    };
  } finally {
    lock.releaseLock();
  }
}

function eapwqV253IsTarget_(headers, row) {
  var source = eapwqV253Cell_(headers, row, 'source').toLowerCase();
  var studentId = eapwqV253Cell_(headers, row, 'studentId');
  var section = eapwqV253Cell_(headers, row, 'section') || eapwqV253Cell_(headers, row, 'group');
  var sessionId = eapwqV253Cell_(headers, row, 'sessionId').toUpperCase();
  return source === EAPWQ_V253_REPAIR_SOURCE &&
    studentId === EAPWQ_V253_REPAIR_FROM_ID &&
    (!section || section === EAPWQ_V253_REPAIR_GROUP) &&
    EAPWQ_V253_REPAIR_FLOW.indexOf(sessionId) >= 0;
}

function eapwqV253WriteAudit_(ss, rows) {
  if (!rows.length) return;
  var headers = [
    'repairedAt','repairVersion','attemptRow','oldStudentId','oldStudentName',
    'newStudentId','newStudentName','sessionId','oldSource','newSource',
    'oldFingerprint','newFingerprint'
  ];
  var sh = ss.getSheetByName(EAPWQ_V253_REPAIR_AUDIT);
  if (!sh) sh = ss.insertSheet(EAPWQ_V253_REPAIR_AUDIT);
  var existing = sh.getLastRow() ? sh.getRange(1, 1, 1, headers.length).getValues()[0].map(String) : [];
  if (existing.join('|') !== headers.join('|')) {
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  sh.autoResizeColumns(1, headers.length);
}

function eapwqV253RebuildProfilesAndSummary_(attemptHeaders, attemptRows) {
  var profileSheet = eapwqSheet_(EAPWQ.profiles);
  var summarySheet = eapwqSheet_(EAPWQ.summary);
  var summaryHeaders = EAPWQ_HEADERS[EAPWQ.summary];

  if (summarySheet.getLastRow() > 1) {
    summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summaryHeaders.length).clearContent();
  }

  attemptRows.forEach(function(row) {
    var raw = eapwqV253RowToInput_(attemptHeaders, row);
    if (!raw.studentId || !raw.sessionId || raw.sessionId === 'PROFILE') return;
    var record = eapwqNormalizeAttempt_(raw, {
      clientTs:raw.clientTs,
      pageUrl:raw.pageUrl,
      userAgent:raw.userAgent,
      schemaVersion:raw.schemaVersion
    });
    eapwqUpsertProfile_(record);
    eapwqUpsertSummary_(record);
  });

  // Keep the profile sheet initialized even when there were no playable rows.
  if (profileSheet.getLastRow() < 1) eapwqSheet_(EAPWQ.profiles);
}

function eapwqV253RowToInput_(headers, row) {
  var get = function(key) { return eapwqV253Cell_(headers, row, key); };
  return {
    attemptId:get('attemptId'), fingerprint:get('fingerprint'),
    studentId:get('studentId'), studentName:get('studentName'),
    group:get('group'), section:get('section'), course:get('course'), game:get('game'),
    arcId:get('arcId'), arc:get('arc'), sessionId:get('sessionId'), sessionTitle:get('sessionTitle'), sessionType:get('sessionType'),
    correct:get('correct'), total:get('total'), accuracy:get('accuracy'), xp:get('xp'), score:get('score'), maxCombo:get('maxCombo'),
    passed:get('passed'), passThreshold:get('passThreshold'), passStatus:get('passStatus'), cefrLevel:get('cefrLevel'),
    aiDifficulty:get('aiDifficulty'), aiPrediction:get('aiPrediction'), hintUsed:get('hintUsed'),
    weakWords:eapwqV253JsonArray_(get('weakWordsJson')), itemTypeWeak:eapwqV253JsonArray_(get('itemTypeWeakJson')),
    levelWeak:eapwqV253JsonArray_(get('levelWeakJson')), responseTimeAvg:get('responseTimeAvg'), attempt:get('attempt'),
    bossHp:get('bossHp'), bossMaxHp:get('bossMaxHp'), isBoss:get('isBoss'), playedAt:get('playedAt'), clientTs:get('clientTs'),
    source:get('source'), pageUrl:get('pageUrl'), userAgent:get('userAgent'), schemaVersion:get('schemaVersion')
  };
}

function eapwqV253Cell_(headers, row, key) {
  var index = headers.indexOf(key);
  return index >= 0 ? eapwqV253Text_(row[index]) : '';
}

function eapwqV253JsonArray_(value) {
  try {
    var parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function eapwqV253Text_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
