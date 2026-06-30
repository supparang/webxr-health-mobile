/* =========================================================
   EAP Word Quest • One-Time Cloud Ledger Repair
   File: /herohealth/eap-word-quest/apps-script/EAPWordQuestRepair-v252.gs
   Version: v2.5.2-SHEETS-LEDGER-REPAIR-122

   Paste this as a NEW Apps Script file (do not replace existing Code.gs),
   then run eapWordQuestRepairUnsafeV243Backfill() once.

   It removes only rows created by the retired unsafe source:
     core-state-backfill-v243
   from eap_word_attempts, copies them to eap_word_quarantine, and rebuilds
   eap_word_summary from the remaining official attempt rows.
========================================================= */

const EAPWQ_REPAIR_V252 = 'v2.5.2-SHEETS-LEDGER-REPAIR-122';
const EAPWQ_REPAIR_GROUP = '122';
const EAPWQ_REPAIR_SOURCE = 'core-state-backfill-v243';
const EAPWQ_REPAIR_ATTEMPTS = 'eap_word_attempts';
const EAPWQ_REPAIR_SUMMARY = 'eap_word_summary';
const EAPWQ_REPAIR_QUARANTINE = 'eap_word_quarantine';
const EAPWQ_REPAIR_TZ = 'Asia/Bangkok';

function eapWordQuestInspectUnsafeV243Backfill() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(EAPWQ_REPAIR_ATTEMPTS);
  if (!sh || sh.getLastRow() < 2) {
    return { ok:true, version:EAPWQ_REPAIR_V252, unsafeRows:0, students:[] };
  }

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const sourceIndex = headers.indexOf('source');
  const idIndex = headers.indexOf('studentId');
  const nameIndex = headers.indexOf('studentName');
  const sessionIndex = headers.indexOf('sessionId');
  if (sourceIndex < 0) throw new Error('eap_word_attempts has no source column');

  const rows = values.slice(1).filter(function(row) {
    return eapwqRepairText_(row[sourceIndex]).toLowerCase() === EAPWQ_REPAIR_SOURCE;
  });
  const byStudent = {};
  rows.forEach(function(row) {
    const key = eapwqRepairText_(row[idIndex]) || 'unknown';
    if (!byStudent[key]) {
      byStudent[key] = { studentId:key, studentName:eapwqRepairText_(row[nameIndex]), rows:0, sessions:[] };
    }
    byStudent[key].rows += 1;
    const sessionId = eapwqRepairText_(row[sessionIndex]);
    if (sessionId && byStudent[key].sessions.indexOf(sessionId) < 0) byStudent[key].sessions.push(sessionId);
  });

  return {
    ok:true,
    version:EAPWQ_REPAIR_V252,
    unsafeRows:rows.length,
    students:Object.keys(byStudent).map(function(key) { return byStudent[key]; })
  };
}

function eapWordQuestRepairUnsafeV243Backfill() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const attempts = ss.getSheetByName(EAPWQ_REPAIR_ATTEMPTS);
    const summary = ss.getSheetByName(EAPWQ_REPAIR_SUMMARY);
    if (!attempts) throw new Error('Missing sheet: ' + EAPWQ_REPAIR_ATTEMPTS);
    if (!summary) throw new Error('Missing sheet: ' + EAPWQ_REPAIR_SUMMARY);

    const attemptValues = attempts.getDataRange().getValues();
    if (attemptValues.length < 1) throw new Error('Attempt sheet is empty');
    const attemptHeaders = attemptValues[0].map(String);
    const sourceIndex = attemptHeaders.indexOf('source');
    if (sourceIndex < 0) throw new Error('eap_word_attempts has no source column');

    const kept = [];
    const removed = [];
    attemptValues.slice(1).forEach(function(row) {
      if (eapwqRepairText_(row[sourceIndex]).toLowerCase() === EAPWQ_REPAIR_SOURCE) removed.push(row);
      else kept.push(row);
    });

    const quarantine = eapwqRepairQuarantineSheet_(ss, attemptHeaders);
    if (removed.length) {
      const stamp = eapwqRepairNow_();
      const auditRows = removed.map(function(row) {
        return [stamp, 'Unsafe legacy profile-based v243 backfill; excluded from official analytics'].concat(row);
      });
      quarantine.getRange(quarantine.getLastRow() + 1, 1, auditRows.length, auditRows[0].length).setValues(auditRows);
    }

    attempts.getRange(2, 1, Math.max(1, attempts.getMaxRows() - 1), attemptHeaders.length).clearContent();
    if (kept.length) attempts.getRange(2, 1, kept.length, attemptHeaders.length).setValues(kept);

    const rebuilt = eapwqRepairBuildSummary_(attemptHeaders, kept, summary.getDataRange().getValues()[0].map(String));
    const summaryHeaders = summary.getDataRange().getValues()[0].map(String);
    summary.getRange(2, 1, Math.max(1, summary.getMaxRows() - 1), summaryHeaders.length).clearContent();
    if (rebuilt.length) summary.getRange(2, 1, rebuilt.length, summaryHeaders.length).setValues(rebuilt);

    SpreadsheetApp.flush();
    return {
      ok:true,
      version:EAPWQ_REPAIR_V252,
      removedUnsafeRows:removed.length,
      retainedOfficialRows:kept.length,
      rebuiltSummaryRows:rebuilt.length,
      quarantineSheet:EAPWQ_REPAIR_QUARANTINE,
      repairedAt:eapwqRepairNow_()
    };
  } finally {
    lock.releaseLock();
  }
}

function eapwqRepairQuarantineSheet_(ss, attemptHeaders) {
  let sh = ss.getSheetByName(EAPWQ_REPAIR_QUARANTINE);
  const headers = ['quarantinedAt','reason'].concat(attemptHeaders);
  if (!sh) sh = ss.insertSheet(EAPWQ_REPAIR_QUARANTINE);
  const existing = sh.getLastColumn() ? sh.getRange(1,1,1,Math.max(headers.length, sh.getLastColumn())).getValues()[0].map(String) : [];
  if (existing.slice(0, headers.length).join('|') !== headers.join('|')) {
    sh.clear();
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function eapwqRepairBuildSummary_(attemptHeaders, rows, summaryHeaders) {
  const index = function(key) { return attemptHeaders.indexOf(key); };
  const get = function(row, key) {
    const i = index(key);
    return i >= 0 ? row[i] : '';
  };
  const asNumber = function(value) {
    const n = Number(value);
    return isFinite(n) ? n : 0;
  };
  const asBool = function(value) {
    return value === true || String(value).toLowerCase() === 'true' || Number(value) === 1;
  };
  const byKey = {};

  rows.forEach(function(row) {
    const studentId = eapwqRepairText_(get(row,'studentId'));
    const sessionId = eapwqRepairText_(get(row,'sessionId')).toUpperCase();
    if (!studentId || !sessionId || sessionId === 'PROFILE') return;

    const key = studentId + '|' + sessionId;
    const playedAt = eapwqRepairText_(get(row,'playedAt'));
    const item = byKey[key] || {
      studentId:studentId,
      sessionId:sessionId,
      studentName:eapwqRepairText_(get(row,'studentName')),
      group:eapwqRepairText_(get(row,'group')) || EAPWQ_REPAIR_GROUP,
      section:eapwqRepairText_(get(row,'section')) || EAPWQ_REPAIR_GROUP,
      sessionTitle:eapwqRepairText_(get(row,'sessionTitle')) || sessionId,
      sessionType:eapwqRepairText_(get(row,'sessionType')),
      bestAccuracy:0,
      bestScore:0,
      passed:false,
      attempts:0,
      lastAccuracy:0,
      lastScore:0,
      lastPlayed:'',
      weakWordsJson:'[]',
      aiPrediction:'',
      _lastTime:-1
    };

    const accuracy = Math.max(0, Math.min(100, Math.round(asNumber(get(row,'accuracy')))));
    const score = Math.max(0, Math.round(asNumber(get(row,'score') || get(row,'xp'))));
    const playedTime = new Date(playedAt || 0).getTime();
    item.bestAccuracy = Math.max(item.bestAccuracy, accuracy);
    item.bestScore = Math.max(item.bestScore, score);
    item.passed = item.passed || asBool(get(row,'passed'));
    item.attempts += 1;

    if (playedTime >= item._lastTime) {
      item._lastTime = playedTime;
      item.studentName = eapwqRepairText_(get(row,'studentName')) || item.studentName;
      item.group = eapwqRepairText_(get(row,'group')) || item.group;
      item.section = eapwqRepairText_(get(row,'section')) || item.section;
      item.sessionTitle = eapwqRepairText_(get(row,'sessionTitle')) || item.sessionTitle;
      item.sessionType = eapwqRepairText_(get(row,'sessionType')) || item.sessionType;
      item.lastAccuracy = accuracy;
      item.lastScore = score;
      item.lastPlayed = playedAt;
      item.weakWordsJson = get(row,'weakWordsJson') || '[]';
      item.aiPrediction = eapwqRepairText_(get(row,'aiPrediction'));
    }
    byKey[key] = item;
  });

  const now = eapwqRepairNow_();
  return Object.keys(byKey).sort().map(function(key) {
    const item = byKey[key];
    const out = {
      serverTs:now,
      studentId:item.studentId,
      studentName:item.studentName,
      group:item.group || EAPWQ_REPAIR_GROUP,
      section:item.section || EAPWQ_REPAIR_GROUP,
      sessionId:item.sessionId,
      sessionTitle:item.sessionTitle,
      sessionType:item.sessionType,
      bestAccuracy:item.bestAccuracy,
      bestScore:item.bestScore,
      passed:String(item.passed),
      attempts:item.attempts,
      lastAccuracy:item.lastAccuracy,
      lastScore:item.lastScore,
      lastPlayed:item.lastPlayed,
      updatedAt:now,
      weakWordsJson:item.weakWordsJson || '[]',
      aiPrediction:item.aiPrediction,
      extraJson:JSON.stringify({ rebuiltBy:EAPWQ_REPAIR_V252, reason:'Removed unsafe v243 backfill rows' })
    };
    return summaryHeaders.map(function(header) { return out[header] == null ? '' : out[header]; });
  });
}

function eapwqRepairText_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function eapwqRepairNow_() {
  return Utilities.formatDate(new Date(), EAPWQ_REPAIR_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
