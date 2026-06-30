/* =========================================================
   EAP Word Quest Group 122 — v254 standalone restore
   File: /herohealth/eap-word-quest/apps-script/EAPWordQuestRestore-v254.gs

   IMPORTANT
   This file is self-contained. It does NOT require EAPWQ, EAPWQ_HEADERS,
   setupEapWordQuest(), or any helper from Code.gs, because this project also
   hosts EAP Session scripts with different global names.

   It restores only legacy rows that v252 moved to eap_word_quarantine.
   Confirmed test facts:
   - KK / 12 completed one full 20-mission route.
   - KP / 50 completed at most one extra session.

   Run:
   1) previewEapWordQuestRestoreV254()
   2) Only when ok:true, runEapWordQuestRestoreV254()
========================================================= */

var EAPWQ_R254_GROUP = '122';
var EAPWQ_R254_SOURCE = 'core-state-backfill-v243';
var EAPWQ_R254_QUARANTINE = 'eap_word_quarantine';
var EAPWQ_R254_ATTEMPTS = 'eap_word_attempts';
var EAPWQ_R254_AUDIT = 'eap_word_restore_audit';
var EAPWQ_R254_FLOW = [
  'S1','S2','S3','BG1',
  'S4','S5','S6','BG2',
  'S7','S8','S9','BG3',
  'S10','S11','S12','BG4',
  'S13','S14','S15','BG5'
];

function inspectEapWordQuestRestoreV254() {
  var plan = eapwqR254Plan_();
  return {
    ok: plan.ok,
    message: plan.message,
    quarantineRows: plan.quarantineRows,
    eligibleRows: plan.rows.length,
    restoreKK: plan.kk.length,
    restoreKP: plan.kp.length,
    missingSessions: plan.missing,
    details: plan.details
  };
}

function applyEapWordQuestRestoreV254() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var plan = eapwqR254Plan_();
    if (!plan.ok) throw new Error(plan.message);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var attempts = ss.getSheetByName(EAPWQ_R254_ATTEMPTS);
    if (!attempts || attempts.getLastRow() < 1) {
      throw new Error('Missing sheet or header row: ' + EAPWQ_R254_ATTEMPTS);
    }

    var attemptValues = attempts.getDataRange().getValues();
    var attemptHeaders = attemptValues[0].map(String);
    var index = eapwqR254Index_(attemptHeaders);
    eapwqR254Require_(index, ['studentId','studentName','group','section','sessionId','source','fingerprint']);

    var seenFingerprints = {};
    for (var i = 1; i < attemptValues.length; i += 1) {
      seenFingerprints[String(attemptValues[i][index.fingerprint] || '')] = true;
    }

    var toAppend = [];
    var auditRows = [];
    var stamp = eapwqR254Now_();

    function restore(candidate, ownerId, ownerName, restoredSource) {
      var row = candidate.data.slice();
      var oldFingerprint = String(row[index.fingerprint] || '');
      var newFingerprint = [
        'v254-restored', EAPWQ_R254_GROUP, ownerId,
        candidate.sessionId, oldFingerprint
      ].join('|');

      if (seenFingerprints[newFingerprint]) return;
      seenFingerprints[newFingerprint] = true;

      row[index.studentId] = ownerId;
      row[index.studentName] = ownerName;
      row[index.group] = EAPWQ_R254_GROUP;
      row[index.section] = EAPWQ_R254_GROUP;
      row[index.source] = restoredSource;
      row[index.fingerprint] = newFingerprint;
      if (index.serverTs >= 0) row[index.serverTs] = stamp;
      if (index.extraJson >= 0) {
        row[index.extraJson] = JSON.stringify({
          restoredBy: 'v254-standalone',
          originalQuarantineRow: candidate.row,
          originalSource: EAPWQ_R254_SOURCE,
          confirmedOwner: { studentId: ownerId, studentName: ownerName },
          originalFingerprint: oldFingerprint
        });
      }

      toAppend.push(row);
      auditRows.push([
        stamp, candidate.row, candidate.sessionId,
        ownerId, ownerName, oldFingerprint, newFingerprint, restoredSource
      ]);
    }

    plan.kk.forEach(function(candidate) {
      restore(candidate, '12', 'KK', 'teacher-confirmed-kk-route-restore-v254');
    });
    plan.kp.forEach(function(candidate) {
      restore(candidate, '50', 'KP', 'teacher-confirmed-kp-one-session-restore-v254');
    });

    if (toAppend.length) {
      attempts.getRange(attempts.getLastRow() + 1, 1, toAppend.length, attemptHeaders.length).setValues(toAppend);
    }
    eapwqR254WriteAudit_(ss, auditRows);
    SpreadsheetApp.flush();

    return {
      ok: true,
      restoredKK: plan.kk.length,
      restoredKP: plan.kp.length,
      appendedRows: toAppend.length,
      auditSheet: EAPWQ_R254_AUDIT,
      note: 'Data was copied back to eap_word_attempts. Quarantine was retained unchanged.'
    };
  } finally {
    lock.releaseLock();
  }
}

function eapwqR254Plan_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var quarantine = ss.getSheetByName(EAPWQ_R254_QUARANTINE);
  var attempts = ss.getSheetByName(EAPWQ_R254_ATTEMPTS);

  if (!quarantine || quarantine.getLastRow() < 2) {
    return eapwqR254Fail_('No rows found in ' + EAPWQ_R254_QUARANTINE + '. Nothing can be restored.');
  }
  if (!attempts || attempts.getLastRow() < 1) {
    return eapwqR254Fail_('Missing sheet or header row: ' + EAPWQ_R254_ATTEMPTS);
  }

  var quarantineValues = quarantine.getDataRange().getValues();
  var quarantineHeaders = quarantineValues[0].map(String);
  var qIndex = eapwqR254Index_(quarantineHeaders);
  eapwqR254Require_(qIndex, ['source','sessionId']);

  var attemptHeaders = attempts.getDataRange().getValues()[0].map(String);
  var rows = [];

  for (var i = 1; i < quarantineValues.length; i += 1) {
    var source = eapwqR254Text_(quarantineValues[i][qIndex.source]).toLowerCase();
    var sessionId = eapwqR254Text_(quarantineValues[i][qIndex.sessionId]).toUpperCase();
    var group = qIndex.group >= 0 ? eapwqR254Text_(quarantineValues[i][qIndex.group]) : '';
    var section = qIndex.section >= 0 ? eapwqR254Text_(quarantineValues[i][qIndex.section]) : '';
    var belongsTo122 = (!group || group === EAPWQ_R254_GROUP) && (!section || section === EAPWQ_R254_GROUP);

    if (source !== EAPWQ_R254_SOURCE || !belongsTo122 || EAPWQ_R254_FLOW.indexOf(sessionId) < 0) continue;

    var data = attemptHeaders.map(function(header) {
      var q = qIndex[header];
      return q >= 0 ? quarantineValues[i][q] : '';
    });
    var playedAt = qIndex.playedAt >= 0 ? quarantineValues[i][qIndex.playedAt] : '';
    var quarantinedAt = qIndex.quarantinedAt >= 0 ? quarantineValues[i][qIndex.quarantinedAt] : '';

    rows.push({
      row: i + 1,
      sessionId: sessionId,
      time: eapwqR254Time_(playedAt || quarantinedAt),
      playedAt: eapwqR254Text_(playedAt),
      data: data
    });
  }

  var bySession = {};
  rows.forEach(function(item) {
    if (!bySession[item.sessionId]) bySession[item.sessionId] = [];
    bySession[item.sessionId].push(item);
  });
  Object.keys(bySession).forEach(function(sessionId) {
    bySession[sessionId].sort(function(a, b) {
      return a.time - b.time || a.row - b.row;
    });
  });

  var kk = [];
  var used = {};
  var missing = [];
  EAPWQ_R254_FLOW.forEach(function(sessionId) {
    var candidates = bySession[sessionId] || [];
    if (!candidates.length) {
      missing.push(sessionId);
      return;
    }
    kk.push(candidates[0]);
    used[candidates[0].row] = true;
  });

  var kp = rows.filter(function(item) { return !used[item.row]; });
  var safe = missing.length === 0 && kp.length <= 1;
  var message = safe
    ? 'Safe plan: restore KK/12 = 20 sessions; restore KP/50 = ' + kp.length + ' extra session.'
    : (missing.length
      ? 'Safety stop: the KK route is incomplete in quarantine. Missing: ' + missing.join(', ')
      : 'Safety stop: found ' + kp.length + ' extra rows. Expected at most 1 for KP/50.');

  return {
    ok: safe,
    message: message,
    quarantineRows: quarantineValues.length - 1,
    rows: rows,
    kk: kk,
    kp: kp,
    missing: missing,
    details: rows.map(function(item) {
      return {
        quarantineRow: item.row,
        sessionId: item.sessionId,
        playedAt: item.playedAt,
        restoreAs: used[item.row] ? 'KK / 12' : 'KP / 50'
      };
    })
  };
}

function eapwqR254Index_(headers) {
  var index = {};
  headers.forEach(function(header, i) { index[String(header)] = i; });
  return index;
}

function eapwqR254Require_(index, names) {
  var missing = names.filter(function(name) { return index[name] == null || index[name] < 0; });
  if (missing.length) throw new Error('Required columns not found: ' + missing.join(', '));
}

function eapwqR254WriteAudit_(ss, rows) {
  if (!rows.length) return;
  var headers = [
    'restoredAt','quarantineRow','sessionId','studentId','studentName',
    'oldFingerprint','newFingerprint','restoredSource'
  ];
  var sheet = ss.getSheetByName(EAPWQ_R254_AUDIT);
  if (!sheet) sheet = ss.insertSheet(EAPWQ_R254_AUDIT);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function eapwqR254Fail_(message) {
  return { ok:false, message:message, quarantineRows:0, rows:[], kk:[], kp:[], missing:EAPWQ_R254_FLOW.slice(), details:[] };
}

function eapwqR254Text_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function eapwqR254Time_(value) {
  var time = new Date(value || 0).getTime();
  return isFinite(time) ? time : 0;
}

function eapwqR254Now_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");
}
