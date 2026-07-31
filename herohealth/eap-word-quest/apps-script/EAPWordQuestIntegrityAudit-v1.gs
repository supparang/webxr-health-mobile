/* =========================================================
   EAP Word Quest • Google Sheets Integrity Audit
   File: EAPWordQuestIntegrityAudit-v1.gs
   Version: 20260731-EAPWQ-INTEGRITY-AUDIT-V1

   Purpose
   - Verify that official EAP Word Quest data is actually present in Sheets.
   - Reconcile eap_word_attempts against eap_word_summary for all 20 sessions.
   - Detect missing sessions, duplicate fingerprints, invalid sessions,
     summary drift, weak-word gaps, and item-level analytics availability.
   - Write a historical audit summary and 20-session detail rows.

   Safe installation
   - Paste this file into the SAME Apps Script project as EAPWordQuest.gs
     and EAPWordQuestAuthority.gs.
   - This file declares no doGet()/doPost() and does not modify gameplay data.

   Run for the current QA account
     EAPWQ_AUDIT_runTestUser()

   Run for another learner
     EAPWQ_AUDIT_run('6811500542', '122')
========================================================= */

const EAPWQ_AUDIT_VERSION = '20260731-EAPWQ-INTEGRITY-AUDIT-V1';
const EAPWQ_AUDIT_TZ = 'Asia/Bangkok';
const EAPWQ_AUDIT_SECTION = '122';
const EAPWQ_AUDIT_FLOW = [
  'S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3',
  'S10','S11','S12','BG4','S13','S14','S15','BG5'
];
const EAPWQ_AUDIT_SHEETS = {
  roster: ['eap_word_roster','EAP_Roster','eap_roster','Student_Roster','students'],
  profiles: 'eap_word_profiles',
  attempts: 'eap_word_attempts',
  summary: 'eap_word_summary',
  audit: 'eap_word_integrity_audit',
  detail: 'eap_word_integrity_detail'
};

const EAPWQ_AUDIT_SUMMARY_HEADERS = [
  'auditTs','auditVersion','studentId','studentName','section',
  'operationalStatus','researchDataStatus','profileRows','rosterRows',
  'attemptRows','summaryRows','uniqueSessionsAttempted','passedSessions',
  'missingSessionsJson','unpassedSessionsJson','duplicateFingerprints',
  'invalidSessionRows','summaryMismatchCount','essentialCompletenessPct',
  'weakWordCoveragePct','itemLevelCoveragePct','compactAttemptRows',
  'notesJson'
];

const EAPWQ_AUDIT_DETAIL_HEADERS = [
  'auditTs','auditVersion','studentId','section','sessionId','threshold',
  'attemptRows','summaryRows','bestAccuracyAttempt','lastAccuracyAttempt',
  'derivedPassed','summaryAttempts','summaryBestAccuracy','summaryLastAccuracy',
  'summaryPassed','duplicateFingerprints','essentialCompletenessPct',
  'weakWordsPresent','itemLevelPresent','sources','status','issuesJson'
];

const EAPWQ_AUDIT_ESSENTIAL_ATTEMPT_FIELDS = [
  'serverTs','attemptId','fingerprint','studentId','studentName','section',
  'sessionId','sessionTitle','sessionType','correct','total','accuracy','xp',
  'score','maxCombo','passed','passThreshold','playedAt','source','schemaVersion'
];

function EAPWQ_AUDIT_runTestUser() {
  return EAPWQ_AUDIT_run('6811000000', EAPWQ_AUDIT_SECTION);
}

function EAPWQ_AUDIT_run(studentId, section) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const report = eapwqAuditBuild_(studentId, section);
    eapwqAuditWrite_(report);
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function EAPWQ_AUDIT_runAll() {
  const ss = eapwqAuditSpreadsheet_();
  const attempts = eapwqAuditObjectsByName_(ss, EAPWQ_AUDIT_SHEETS.attempts);
  const ids = {};
  attempts.forEach(function(row) {
    const id = eapwqAuditStudentId_(eapwqAuditPick_(row,['studentId','student_id','id']));
    const sec = eapwqAuditSection_(eapwqAuditPick_(row,['section','group']));
    if (id && sec === EAPWQ_AUDIT_SECTION) ids[id] = true;
  });
  return Object.keys(ids).sort().map(function(id) {
    return EAPWQ_AUDIT_run(id, EAPWQ_AUDIT_SECTION);
  });
}

function eapwqAuditBuild_(studentId, section) {
  const id = eapwqAuditStudentId_(studentId);
  const sec = eapwqAuditSection_(section || EAPWQ_AUDIT_SECTION);
  if (!id) throw new Error('studentId is required');
  if (sec !== EAPWQ_AUDIT_SECTION) throw new Error('Only section 122 is allowed');

  const ss = eapwqAuditSpreadsheet_();
  const auditTs = eapwqAuditNow_();
  const profileRows = eapwqAuditObjectsByName_(ss, EAPWQ_AUDIT_SHEETS.profiles).filter(function(row) {
    return eapwqAuditMatchesStudent_(row,id,sec);
  });
  const attemptRows = eapwqAuditObjectsByName_(ss, EAPWQ_AUDIT_SHEETS.attempts).filter(function(row) {
    return eapwqAuditMatchesStudent_(row,id,sec);
  });
  const summaryRows = eapwqAuditObjectsByName_(ss, EAPWQ_AUDIT_SHEETS.summary).filter(function(row) {
    return eapwqAuditMatchesStudent_(row,id,sec);
  });
  const rosterSheet = eapwqAuditFindSheet_(ss,EAPWQ_AUDIT_SHEETS.roster);
  const rosterRows = rosterSheet ? eapwqAuditObjects_(rosterSheet).filter(function(row) {
    return eapwqAuditMatchesStudent_(row,id,sec);
  }) : [];

  const studentName = eapwqAuditText_(
    eapwqAuditPick_(profileRows[0] || {},['studentName','student_name','name']) ||
    eapwqAuditPick_(rosterRows[0] || {},['studentName','student_name','name','ชื่อ','ชื่อ-สกุล']) ||
    eapwqAuditPick_(attemptRows[0] || {},['studentName','student_name','name'])
  );

  const invalidAttemptRows = attemptRows.filter(function(row) {
    return EAPWQ_AUDIT_FLOW.indexOf(eapwqAuditSessionId_(eapwqAuditPick_(row,['sessionId','session']))) < 0;
  });

  const duplicateMap = eapwqAuditDuplicateFingerprintMap_(attemptRows);
  const duplicateFingerprintCount = Object.keys(duplicateMap).length;
  const details = [];
  let summaryMismatchCount = 0;
  let essentialCellsPresent = 0;
  let essentialCellsExpected = 0;
  let weakWordEligibleRows = 0;
  let weakWordCoveredRows = 0;
  let itemLevelRows = 0;
  let compactAttemptRows = 0;

  attemptRows.forEach(function(row) {
    EAPWQ_AUDIT_ESSENTIAL_ATTEMPT_FIELDS.forEach(function(field) {
      essentialCellsExpected += 1;
      if (eapwqAuditHasValue_(eapwqAuditPick_(row,[field]))) essentialCellsPresent += 1;
    });
    const correct = eapwqAuditNum_(eapwqAuditPick_(row,['correct']),0);
    const total = eapwqAuditNum_(eapwqAuditPick_(row,['total']),0);
    if (total > correct) {
      weakWordEligibleRows += 1;
      if (eapwqAuditArray_(eapwqAuditPick_(row,['weakWordsJson','weakWords'])).length) weakWordCoveredRows += 1;
    }
    if (eapwqAuditHasItemLevel_(row)) itemLevelRows += 1;
    if (/compact/i.test(eapwqAuditText_(eapwqAuditPick_(row,['source','schemaVersion'])))) compactAttemptRows += 1;
  });

  EAPWQ_AUDIT_FLOW.forEach(function(sessionId) {
    const attempts = attemptRows.filter(function(row) {
      return eapwqAuditSessionId_(eapwqAuditPick_(row,['sessionId','session'])) === sessionId;
    });
    const summaries = summaryRows.filter(function(row) {
      return eapwqAuditSessionId_(eapwqAuditPick_(row,['sessionId','session'])) === sessionId;
    });
    const threshold = eapwqAuditThreshold_(sessionId);
    const latestAttempt = eapwqAuditLatest_(attempts);
    const summary = eapwqAuditLatest_(summaries);
    const bestAccuracyAttempt = eapwqAuditMax_(attempts,['accuracy']);
    const lastAccuracyAttempt = eapwqAuditNum_(eapwqAuditPick_(latestAttempt || {},['accuracy']),0);
    const derivedPassed = attempts.some(function(row) {
      return eapwqAuditBool_(eapwqAuditPick_(row,['passed'])) ||
        eapwqAuditNum_(eapwqAuditPick_(row,['accuracy']),0) >= threshold;
    });
    const summaryAttempts = eapwqAuditNum_(eapwqAuditPick_(summary || {},['attempts']),0);
    const summaryBestAccuracy = eapwqAuditNum_(eapwqAuditPick_(summary || {},['bestAccuracy','accuracy']),0);
    const summaryLastAccuracy = eapwqAuditNum_(eapwqAuditPick_(summary || {},['lastAccuracy','accuracy']),0);
    const summaryPassed = eapwqAuditBool_(eapwqAuditPick_(summary || {},['passed'])) || summaryBestAccuracy >= threshold;
    const issues = [];

    if (!attempts.length) issues.push('missing_attempt');
    if (summaries.length !== 1) issues.push(summaries.length ? 'duplicate_summary_rows' : 'missing_summary');
    if (summary && summaryAttempts !== attempts.length) issues.push('summary_attempt_count_mismatch');
    if (summary && Math.round(summaryBestAccuracy) !== Math.round(bestAccuracyAttempt)) issues.push('summary_best_accuracy_mismatch');
    if (summary && Math.round(summaryLastAccuracy) !== Math.round(lastAccuracyAttempt)) issues.push('summary_last_accuracy_mismatch');
    if (summary && summaryPassed !== derivedPassed) issues.push('summary_pass_mismatch');

    const duplicateFingerprints = eapwqAuditSessionDuplicateCount_(attempts,duplicateMap);
    if (duplicateFingerprints) issues.push('duplicate_fingerprint');

    let sessionEssentialPresent = 0;
    let sessionEssentialExpected = 0;
    attempts.forEach(function(row) {
      EAPWQ_AUDIT_ESSENTIAL_ATTEMPT_FIELDS.forEach(function(field) {
        sessionEssentialExpected += 1;
        if (eapwqAuditHasValue_(eapwqAuditPick_(row,[field]))) sessionEssentialPresent += 1;
      });
    });

    const weakWordsPresent = attempts.some(function(row) {
      const correct = eapwqAuditNum_(eapwqAuditPick_(row,['correct']),0);
      const total = eapwqAuditNum_(eapwqAuditPick_(row,['total']),0);
      return total <= correct || eapwqAuditArray_(eapwqAuditPick_(row,['weakWordsJson','weakWords'])).length > 0;
    });
    const itemLevelPresent = attempts.some(eapwqAuditHasItemLevel_);
    const sources = {};
    attempts.forEach(function(row) {
      const source = eapwqAuditText_(eapwqAuditPick_(row,['source','schemaVersion'])) || 'unknown';
      sources[source] = true;
    });

    const status = issues.length ? 'CHECK' : (derivedPassed ? 'PASS' : 'NOT_PASSED');
    if (issues.length) summaryMismatchCount += 1;

    details.push({
      auditTs:auditTs,
      auditVersion:EAPWQ_AUDIT_VERSION,
      studentId:id,
      section:sec,
      sessionId:sessionId,
      threshold:threshold,
      attemptRows:attempts.length,
      summaryRows:summaries.length,
      bestAccuracyAttempt:Math.round(bestAccuracyAttempt),
      lastAccuracyAttempt:Math.round(lastAccuracyAttempt),
      derivedPassed:derivedPassed,
      summaryAttempts:summaryAttempts,
      summaryBestAccuracy:Math.round(summaryBestAccuracy),
      summaryLastAccuracy:Math.round(summaryLastAccuracy),
      summaryPassed:summaryPassed,
      duplicateFingerprints:duplicateFingerprints,
      essentialCompletenessPct:eapwqAuditPct_(sessionEssentialPresent,sessionEssentialExpected),
      weakWordsPresent:weakWordsPresent,
      itemLevelPresent:itemLevelPresent,
      sources:Object.keys(sources).sort().join('|'),
      status:status,
      issuesJson:JSON.stringify(issues)
    });
  });

  const attemptedSessions = details.filter(function(row) { return row.attemptRows > 0; }).map(function(row) { return row.sessionId; });
  const passedSessions = details.filter(function(row) { return row.derivedPassed; }).map(function(row) { return row.sessionId; });
  const missingSessions = EAPWQ_AUDIT_FLOW.filter(function(id2) { return attemptedSessions.indexOf(id2) < 0; });
  const unpassedSessions = EAPWQ_AUDIT_FLOW.filter(function(id2) { return passedSessions.indexOf(id2) < 0; });
  const essentialCompletenessPct = eapwqAuditPct_(essentialCellsPresent,essentialCellsExpected);
  const weakWordCoveragePct = weakWordEligibleRows ? eapwqAuditPct_(weakWordCoveredRows,weakWordEligibleRows) : 100;
  const itemLevelCoveragePct = attemptRows.length ? eapwqAuditPct_(itemLevelRows,attemptRows.length) : 0;

  const operationalPass = profileRows.length === 1 && rosterRows.length === 1 &&
    missingSessions.length === 0 && unpassedSessions.length === 0 &&
    duplicateFingerprintCount === 0 && invalidAttemptRows.length === 0 &&
    summaryMismatchCount === 0 && essentialCompletenessPct >= 95;

  let researchDataStatus = 'INCOMPLETE';
  if (operationalPass && itemLevelCoveragePct >= 90) researchDataStatus = 'FULL_ITEM_LEVEL';
  else if (operationalPass) researchDataStatus = 'SESSION_LEVEL_ONLY';

  const notes = [];
  if (compactAttemptRows) notes.push('V280 compact rows do not contain full item-level analytics.');
  if (itemLevelCoveragePct < 90) notes.push('Item response, distractor, per-item timing, and answer-change analysis are not fully available.');
  if (weakWordCoveragePct < 100) notes.push('Some attempts with incorrect answers have no Weak Words payload.');
  if (profileRows.length !== 1) notes.push('Expected exactly one eap_word_profiles row for this student.');
  if (rosterRows.length !== 1) notes.push('Expected exactly one active roster row for this student.');

  return {
    ok:true,
    action:'eap_word_integrity_audit',
    auditTs:auditTs,
    auditVersion:EAPWQ_AUDIT_VERSION,
    spreadsheetId:ss.getId(),
    studentId:id,
    studentName:studentName,
    section:sec,
    operationalStatus:operationalPass ? 'PASS' : 'CHECK',
    researchDataStatus:researchDataStatus,
    profileRows:profileRows.length,
    rosterRows:rosterRows.length,
    attemptRows:attemptRows.length,
    summaryRows:summaryRows.length,
    uniqueSessionsAttempted:attemptedSessions.length,
    passedSessions:passedSessions.length,
    missingSessions:missingSessions,
    unpassedSessions:unpassedSessions,
    duplicateFingerprints:duplicateFingerprintCount,
    duplicateFingerprintMap:duplicateMap,
    invalidSessionRows:invalidAttemptRows.length,
    summaryMismatchCount:summaryMismatchCount,
    essentialCompletenessPct:essentialCompletenessPct,
    weakWordCoveragePct:weakWordCoveragePct,
    itemLevelCoveragePct:itemLevelCoveragePct,
    compactAttemptRows:compactAttemptRows,
    notes:notes,
    details:details
  };
}

function eapwqAuditWrite_(report) {
  const ss = eapwqAuditSpreadsheet_();
  const summarySheet = eapwqAuditEnsureSheet_(ss,EAPWQ_AUDIT_SHEETS.audit,EAPWQ_AUDIT_SUMMARY_HEADERS);
  const detailSheet = eapwqAuditEnsureSheet_(ss,EAPWQ_AUDIT_SHEETS.detail,EAPWQ_AUDIT_DETAIL_HEADERS);

  const summaryRecord = {
    auditTs:report.auditTs,
    auditVersion:report.auditVersion,
    studentId:report.studentId,
    studentName:report.studentName,
    section:report.section,
    operationalStatus:report.operationalStatus,
    researchDataStatus:report.researchDataStatus,
    profileRows:report.profileRows,
    rosterRows:report.rosterRows,
    attemptRows:report.attemptRows,
    summaryRows:report.summaryRows,
    uniqueSessionsAttempted:report.uniqueSessionsAttempted,
    passedSessions:report.passedSessions,
    missingSessionsJson:JSON.stringify(report.missingSessions),
    unpassedSessionsJson:JSON.stringify(report.unpassedSessions),
    duplicateFingerprints:report.duplicateFingerprints,
    invalidSessionRows:report.invalidSessionRows,
    summaryMismatchCount:report.summaryMismatchCount,
    essentialCompletenessPct:report.essentialCompletenessPct,
    weakWordCoveragePct:report.weakWordCoveragePct,
    itemLevelCoveragePct:report.itemLevelCoveragePct,
    compactAttemptRows:report.compactAttemptRows,
    notesJson:JSON.stringify(report.notes)
  };

  summarySheet.appendRow(EAPWQ_AUDIT_SUMMARY_HEADERS.map(function(key) { return summaryRecord[key]; }));
  if (report.details.length) {
    const rows = report.details.map(function(item) {
      return EAPWQ_AUDIT_DETAIL_HEADERS.map(function(key) { return item[key]; });
    });
    detailSheet.getRange(detailSheet.getLastRow() + 1,1,rows.length,EAPWQ_AUDIT_DETAIL_HEADERS.length).setValues(rows);
  }

  eapwqAuditFormat_(summarySheet,detailSheet);
}

function eapwqAuditFormat_(summarySheet, detailSheet) {
  [summarySheet,detailSheet].forEach(function(sh) {
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold').setBackground('#DCFCE7');
    sh.autoResizeColumns(1,sh.getLastColumn());
  });
}

function eapwqAuditSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = eapwqAuditText_(props.getProperty('EAPWQ_SPREADSHEET_ID'));
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('EAP Word Quest spreadsheet is unavailable.');
  if (!id) props.setProperty('EAPWQ_SPREADSHEET_ID',ss.getId());
  return ss;
}

function eapwqAuditFindSheet_(ss,names) {
  const list = Array.isArray(names) ? names : [names];
  for (let i = 0; i < list.length; i += 1) {
    const sh = ss.getSheetByName(list[i]);
    if (sh) return sh;
  }
  return null;
}

function eapwqAuditObjectsByName_(ss,name) {
  const sh = ss.getSheetByName(name);
  return sh ? eapwqAuditObjects_(sh) : [];
}

function eapwqAuditObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(eapwqAuditText_);
  return values.slice(1).map(function(row) {
    const out = {};
    headers.forEach(function(header,index) { if (header) out[header] = row[index]; });
    return out;
  }).filter(function(row) {
    return Object.keys(row).some(function(key) { return eapwqAuditHasValue_(row[key]); });
  });
}

function eapwqAuditEnsureSheet_(ss,name,headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return sh;
  }
  const existing = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(eapwqAuditText_);
  const next = existing.slice();
  headers.forEach(function(header) { if (next.indexOf(header) < 0) next.push(header); });
  if (next.length !== existing.length) sh.getRange(1,1,1,next.length).setValues([next]);
  return sh;
}

function eapwqAuditMatchesStudent_(row,studentId,section) {
  const id = eapwqAuditStudentId_(eapwqAuditPick_(row,['studentId','student_id','id','รหัสนักศึกษา','รหัส']));
  const sec = eapwqAuditSection_(eapwqAuditPick_(row,['section','group','class','กลุ่ม','หมู่เรียน']));
  return id === studentId && sec === section;
}

function eapwqAuditDuplicateFingerprintMap_(rows) {
  const counts = {};
  (rows || []).forEach(function(row) {
    const fp = eapwqAuditText_(eapwqAuditPick_(row,['fingerprint']));
    if (fp) counts[fp] = (counts[fp] || 0) + 1;
  });
  const duplicates = {};
  Object.keys(counts).forEach(function(fp) { if (counts[fp] > 1) duplicates[fp] = counts[fp]; });
  return duplicates;
}

function eapwqAuditSessionDuplicateCount_(rows,duplicateMap) {
  const found = {};
  (rows || []).forEach(function(row) {
    const fp = eapwqAuditText_(eapwqAuditPick_(row,['fingerprint']));
    if (fp && duplicateMap[fp]) found[fp] = true;
  });
  return Object.keys(found).length;
}

function eapwqAuditHasItemLevel_(row) {
  const raw = eapwqAuditText_(eapwqAuditPick_(row,['extraJson']));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return eapwqAuditObjectHasItemLevel_(parsed,0);
  } catch (ignore) {
    return false;
  }
}

function eapwqAuditObjectHasItemLevel_(value,depth) {
  if (depth > 5 || value == null) return false;
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object') return true;
    return value.some(function(item) { return eapwqAuditObjectHasItemLevel_(item,depth + 1); });
  }
  if (typeof value !== 'object') return false;
  return Object.keys(value).some(function(key) {
    if (/^(items?|itemResults?|responses?|answers?|questionLog|choices?|distractors?|answerChanges?)$/i.test(key)) {
      const v = value[key];
      return Array.isArray(v) ? v.length > 0 : Boolean(v && typeof v === 'object');
    }
    return eapwqAuditObjectHasItemLevel_(value[key],depth + 1);
  });
}

function eapwqAuditPick_(row,keys) {
  const source = row || {};
  const lookup = {};
  Object.keys(source).forEach(function(key) { lookup[eapwqAuditKey_(key)] = source[key]; });
  for (let i = 0; i < keys.length; i += 1) {
    const value = lookup[eapwqAuditKey_(keys[i])];
    if (value !== undefined && value !== null && eapwqAuditHasValue_(value)) return value;
  }
  return '';
}

function eapwqAuditLatest_(rows) {
  return (rows || []).slice().sort(function(a,b) { return eapwqAuditTime_(b) - eapwqAuditTime_(a); })[0] || null;
}

function eapwqAuditTime_(row) {
  const value = eapwqAuditPick_(row || {},['playedAt','lastPlayed','serverTs','updatedAt','clientTs']);
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(eapwqAuditText_(value));
  return isFinite(parsed) ? parsed : 0;
}

function eapwqAuditMax_(rows,keys) {
  return Math.max.apply(null,[0].concat((rows || []).map(function(row) {
    return eapwqAuditNum_(eapwqAuditPick_(row,keys),0);
  })));
}

function eapwqAuditThreshold_(sessionId) {
  if (sessionId === 'BG5') return 75;
  if (/^BG/.test(sessionId)) return 70;
  return 60;
}

function eapwqAuditSessionId_(value) {
  const raw = eapwqAuditText_(value).toUpperCase();
  if (/^B[1-5]$/.test(raw)) return 'BG' + raw.slice(1);
  return raw;
}

function eapwqAuditArray_(value) {
  if (Array.isArray(value)) return value.map(eapwqAuditText_).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(eapwqAuditText_).filter(Boolean);
    } catch (ignore) {}
    return value.split(/[|,;]/).map(eapwqAuditText_).filter(Boolean);
  }
  return [];
}

function eapwqAuditKey_(value) { return eapwqAuditText_(value).toLowerCase().replace(/[\s_\-]+/g,''); }
function eapwqAuditText_(value) { return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
function eapwqAuditStudentId_(value) { return eapwqAuditText_(value).replace(/\.0$/,'').replace(/\s+/g,''); }
function eapwqAuditSection_(value) {
  const raw = eapwqAuditText_(value || EAPWQ_AUDIT_SECTION).toUpperCase();
  return raw.replace(/^SECTION\s*/i,'').replace(/^SEC\s*/i,'') || EAPWQ_AUDIT_SECTION;
}
function eapwqAuditNum_(value,fallback) {
  const n = Number(value);
  return isFinite(n) ? n : (fallback == null ? 0 : fallback);
}
function eapwqAuditBool_(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
}
function eapwqAuditHasValue_(value) {
  if (value === 0 || value === false) return true;
  return eapwqAuditText_(value) !== '';
}
function eapwqAuditPct_(numerator,denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}
function eapwqAuditNow_() {
  return Utilities.formatDate(new Date(),EAPWQ_AUDIT_TZ,"yyyy-MM-dd'T'HH:mm:ssXXX");
}
