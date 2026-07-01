/* =========================================================
   EAP Word Quest • One-time S2 Mislabel Repair
   File: EAPWordQuestRepair-v271-S2Mislabel.gs

   Repairs only the confirmed test row caused by v270 reading a stale S1 log
   while the learner had completed S2.

   Target evidence from the test:
   - KP / studentId 12 / group 122
   - wrong session S1, accuracy 92, XP/score 1511
   - correct session S2, title UK Campus Decoder

   Safety:
   - preview first
   - apply only proceeds when exactly ONE candidate exists
   - never deletes a row; writes an audit row first
========================================================= */

const EAPWQ_S2_REPAIR_VERSION = 'v2.7.1-S2-MISLABEL-REPAIR-122';
const EAPWQ_S2_REPAIR_ATTEMPTS = 'eap_word_attempts';
const EAPWQ_S2_REPAIR_AUDIT = 'eap_word_s2_mislabel_audit';

function previewEapWordQuestS2MislabelRepair() {
  const plan = eapwqS2MislabelPlan_();
  return {
    ok: plan.candidates.length === 1,
    version: EAPWQ_S2_REPAIR_VERSION,
    message: plan.candidates.length === 1
      ? 'One safe candidate found.'
      : 'Expected exactly one candidate; no change is safe yet.',
    candidates: plan.candidates
  };
}

function applyEapWordQuestS2MislabelRepair() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const plan = eapwqS2MislabelPlan_();
    if (plan.candidates.length !== 1) {
      throw new Error('Expected exactly one repair candidate; found ' + plan.candidates.length + '. Run preview first.');
    }

    const candidate = plan.candidates[0];
    const sh = plan.sheet;
    const headers = plan.headers;
    const row = candidate.row.slice();
    const stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");
    const before = row.slice();

    function put(name, value) {
      const index = headers.indexOf(name);
      if (index >= 0) row[index] = value;
    }

    put('sessionId', 'S2');
    put('sessionTitle', 'UK Campus Decoder');
    put('sessionType', 'session');
    put('source', 'v271-repaired-from-stale-s1');

    const oldFingerprint = String(before[headers.indexOf('fingerprint')] || '').trim();
    const newFingerprint = [
      'v271-repair',
      '122',
      '12',
      'S2',
      candidate.playedAt || stamp,
      oldFingerprint
    ].join('|');
    put('fingerprint', newFingerprint);

    const extraIndex = headers.indexOf('extraJson');
    if (extraIndex >= 0) {
      row[extraIndex] = JSON.stringify({
        repairedBy: EAPWQ_S2_REPAIR_VERSION,
        repairedAt: stamp,
        reason: 'v270 used stale S1 log while active summary was S2',
        before: {
          sessionId: candidate.sessionId,
          sessionTitle: candidate.sessionTitle,
          fingerprint: oldFingerprint
        },
        after: {
          sessionId: 'S2',
          sessionTitle: 'UK Campus Decoder',
          fingerprint: newFingerprint
        }
      });
    }

    eapwqS2MislabelAudit_(plan.ss, [[
      stamp,
      EAPWQ_S2_REPAIR_ATTEMPTS,
      candidate.rowNumber,
      candidate.studentId,
      candidate.studentName,
      candidate.playedAt,
      candidate.sessionId,
      'S2',
      candidate.sessionTitle,
      'UK Campus Decoder',
      oldFingerprint,
      newFingerprint
    ]]);

    sh.getRange(candidate.rowNumber, 1, 1, headers.length).setValues([row]);
    SpreadsheetApp.flush();

    return {
      ok: true,
      version: EAPWQ_S2_REPAIR_VERSION,
      repairedRow: candidate.rowNumber,
      before: { sessionId: candidate.sessionId, sessionTitle: candidate.sessionTitle },
      after: { sessionId: 'S2', sessionTitle: 'UK Campus Decoder' }
    };
  } finally {
    lock.releaseLock();
  }
}

function eapwqS2MislabelPlan_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(EAPWQ_S2_REPAIR_ATTEMPTS);
  if (!sh || sh.getLastRow() < 2) {
    return { ss: ss, sheet: sh, headers: [], candidates: [] };
  }

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(function(value) { return String(value || '').trim(); });
  const at = function(row, key) {
    const index = headers.indexOf(key);
    return index >= 0 ? row[index] : '';
  };
  const text = function(value) { return String(value == null ? '' : value).trim(); };
  const numeric = function(value) {
    const n = Number(value);
    return isFinite(n) ? n : 0;
  };

  const candidates = [];
  values.slice(1).forEach(function(row, index) {
    const studentId = text(at(row, 'studentId'));
    const studentName = text(at(row, 'studentName'));
    const section = text(at(row, 'section')) || text(at(row, 'group'));
    const sessionId = text(at(row, 'sessionId')).toUpperCase();
    const accuracy = numeric(at(row, 'accuracy'));
    const xp = numeric(at(row, 'xp'));
    const score = numeric(at(row, 'score'));

    if (
      studentId !== '12' ||
      studentName !== 'KP' ||
      section !== '122' ||
      sessionId !== 'S1' ||
      accuracy !== 92 ||
      (xp !== 1511 && score !== 1511)
    ) {
      return;
    }

    candidates.push({
      rowNumber: index + 2,
      row: row,
      studentId: studentId,
      studentName: studentName,
      playedAt: text(at(row, 'playedAt')),
      sessionId: sessionId,
      sessionTitle: text(at(row, 'sessionTitle')),
      accuracy: accuracy,
      xp: xp,
      score: score,
      source: text(at(row, 'source')),
      fingerprint: text(at(row, 'fingerprint'))
    });
  });

  return { ss: ss, sheet: sh, headers: headers, candidates: candidates };
}

function eapwqS2MislabelAudit_(ss, rows) {
  if (!rows.length) return;

  const headers = [
    'repairedAt', 'sheet', 'rowNumber', 'studentId', 'studentName',
    'playedAt', 'beforeSessionId', 'afterSessionId',
    'beforeSessionTitle', 'afterSessionTitle', 'beforeFingerprint', 'afterFingerprint'
  ];

  let sh = ss.getSheetByName(EAPWQ_S2_REPAIR_AUDIT);
  if (!sh) sh = ss.insertSheet(EAPWQ_S2_REPAIR_AUDIT);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}
