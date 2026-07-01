/* =========================================================
   EAP Word Quest • Canonical Identity Fix
   File: EAPWordQuest_CanonicalKP50-v265.gs
   Version: v2.6.5-CANONICAL-KP50-122

   Purpose
   - Canonicalise the confirmed test learner identity in Section 122.
   - Adds/updates eap_identity_map: wordquest | 122 | 50 -> KP / 50.
   - Normalises existing Word Quest profile, attempt and summary names to KP.
   - Writes an audit trail before changing historical rows.

   Safe operation
   1) Run previewEapWordQuestCanonicalKP50() first.
   2) Run applyEapWordQuestCanonicalKP50() once after confirming preview.
   3) It never deletes attempts or summary evidence.
========================================================= */

const EAPWQ_KP50_FIX_VERSION = 'v2.6.5-CANONICAL-KP50-122';
const EAPWQ_KP50_FIX_SECTION = '122';
const EAPWQ_KP50_FIX_ID = '50';
const EAPWQ_KP50_FIX_NAME = 'KP';
const EAPWQ_KP50_FIX_SOURCE = 'wordquest';
const EAPWQ_KP50_FIX_AUDIT = 'eap_word_canonical_identity_audit';

function previewEapWordQuestCanonicalKP50() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const output = {
    ok: true,
    version: EAPWQ_KP50_FIX_VERSION,
    target: {
      source: EAPWQ_KP50_FIX_SOURCE,
      section: EAPWQ_KP50_FIX_SECTION,
      studentId: EAPWQ_KP50_FIX_ID,
      studentName: EAPWQ_KP50_FIX_NAME
    },
    identityMapRows: 0,
    sheets: {}
  };

  const identity = ss.getSheetByName('eap_identity_map');
  if (identity && identity.getLastRow() > 1) {
    const values = identity.getDataRange().getValues();
    const headers = values[0].map(eapwqKp50Text_);
    output.identityMapRows = values.slice(1).filter(function(row) {
      return eapwqKp50Text_(row[headers.indexOf('source')]).toLowerCase() === EAPWQ_KP50_FIX_SOURCE &&
        eapwqKp50Text_(row[headers.indexOf('aliasStudentId')]) === EAPWQ_KP50_FIX_ID &&
        eapwqKp50Text_(row[headers.indexOf('section')]) === EAPWQ_KP50_FIX_SECTION;
    }).length;
  }

  ['eap_word_profiles', 'eap_word_attempts', 'eap_word_summary'].forEach(function(sheetName) {
    output.sheets[sheetName] = eapwqKp50CountCandidates_(ss, sheetName);
  });

  return output;
}

function applyEapWordQuestCanonicalKP50() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stamp = eapwqKp50Now_();
    const auditRows = [];

    const mapResult = eapwqKp50UpsertIdentityMap_(ss, stamp, auditRows);
    const sheetResults = {};

    ['eap_word_profiles', 'eap_word_attempts', 'eap_word_summary'].forEach(function(sheetName) {
      sheetResults[sheetName] = eapwqKp50CanonicalizeSheet_(ss, sheetName, stamp, auditRows);
    });

    eapwqKp50AppendAudit_(ss, auditRows);
    SpreadsheetApp.flush();

    return {
      ok: true,
      version: EAPWQ_KP50_FIX_VERSION,
      map: mapResult,
      sheets: sheetResults,
      auditRows: auditRows.length,
      appliedAt: stamp
    };
  } finally {
    lock.releaseLock();
  }
}

function eapwqKp50CountCandidates_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) {
    return { exists: Boolean(sh), candidates: 0, names: [] };
  }

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(eapwqKp50Text_);
  const idIndex = headers.indexOf('studentId');
  const nameIndex = headers.indexOf('studentName');
  const groupIndex = headers.indexOf('group');
  const sectionIndex = headers.indexOf('section');

  if (idIndex < 0) {
    return { exists: true, candidates: 0, names: [], error: 'studentId column not found' };
  }

  const names = {};
  let candidates = 0;

  values.slice(1).forEach(function(row) {
    if (!eapwqKp50Matches_(row, idIndex, groupIndex, sectionIndex)) return;
    candidates += 1;
    const name = nameIndex >= 0 ? eapwqKp50Text_(row[nameIndex]) : '';
    if (name) names[name] = true;
  });

  return {
    exists: true,
    candidates: candidates,
    names: Object.keys(names)
  };
}

function eapwqKp50UpsertIdentityMap_(ss, stamp, auditRows) {
  const headers = [
    'source',
    'aliasStudentId',
    'canonicalStudentId',
    'canonicalStudentName',
    'section',
    'enabled',
    'note',
    'updatedAt'
  ];

  let sh = ss.getSheetByName('eap_identity_map');
  if (!sh) {
    sh = ss.insertSheet('eap_identity_map');
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  const actualHeaders = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).getValues()[0].map(eapwqKp50Text_);
  headers.forEach(function(header) {
    if (actualHeaders.indexOf(header) < 0) {
      actualHeaders.push(header);
    }
  });
  sh.getRange(1, 1, 1, actualHeaders.length).setValues([actualHeaders]);

  const sourceIndex = actualHeaders.indexOf('source');
  const aliasIndex = actualHeaders.indexOf('aliasStudentId');
  const canonicalIdIndex = actualHeaders.indexOf('canonicalStudentId');
  const canonicalNameIndex = actualHeaders.indexOf('canonicalStudentName');
  const sectionIndex = actualHeaders.indexOf('section');
  const enabledIndex = actualHeaders.indexOf('enabled');
  const noteIndex = actualHeaders.indexOf('note');
  const updatedAtIndex = actualHeaders.indexOf('updatedAt');

  const values = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, actualHeaders.length).getValues()
    : [];

  const matchedRows = [];
  values.forEach(function(row, index) {
    const source = eapwqKp50Text_(row[sourceIndex]).toLowerCase();
    const alias = eapwqKp50Text_(row[aliasIndex]);
    const section = eapwqKp50Text_(row[sectionIndex]);
    if (source === EAPWQ_KP50_FIX_SOURCE && alias === EAPWQ_KP50_FIX_ID && section === EAPWQ_KP50_FIX_SECTION) {
      matchedRows.push(index);
    }
  });

  const canonicalRow = function(existing) {
    const row = existing ? existing.slice() : new Array(actualHeaders.length).fill('');
    const before = row.slice();
    row[sourceIndex] = EAPWQ_KP50_FIX_SOURCE;
    row[aliasIndex] = EAPWQ_KP50_FIX_ID;
    row[canonicalIdIndex] = EAPWQ_KP50_FIX_ID;
    row[canonicalNameIndex] = EAPWQ_KP50_FIX_NAME;
    row[sectionIndex] = EAPWQ_KP50_FIX_SECTION;
    row[enabledIndex] = true;
    row[noteIndex] = 'Confirmed canonical test identity: KP / 50';
    row[updatedAtIndex] = stamp;
    return { row: row, before: before };
  };

  if (matchedRows.length) {
    matchedRows.forEach(function(index) {
      const replacement = canonicalRow(values[index]);
      if (JSON.stringify(replacement.before) !== JSON.stringify(replacement.row)) {
        auditRows.push([stamp, 'eap_identity_map', index + 2, 'map_upsert', '', '', JSON.stringify(replacement.before), JSON.stringify(replacement.row)]);
        values[index] = replacement.row;
      }
    });
    if (values.length) {
      sh.getRange(2, 1, values.length, actualHeaders.length).setValues(values);
    }
  } else {
    const replacement = canonicalRow(null);
    sh.getRange(sh.getLastRow() + 1, 1, 1, actualHeaders.length).setValues([replacement.row]);
    auditRows.push([stamp, 'eap_identity_map', sh.getLastRow(), 'map_insert', '', '', '', JSON.stringify(replacement.row)]);
  }

  return {
    matchedRows: matchedRows.length,
    canonicalName: EAPWQ_KP50_FIX_NAME,
    canonicalId: EAPWQ_KP50_FIX_ID
  };
}

function eapwqKp50CanonicalizeSheet_(ss, sheetName, stamp, auditRows) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) {
    return { exists: Boolean(sh), changed: 0, scanned: 0 };
  }

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(eapwqKp50Text_);
  const idIndex = headers.indexOf('studentId');
  const nameIndex = headers.indexOf('studentName');
  const groupIndex = headers.indexOf('group');
  const sectionIndex = headers.indexOf('section');

  if (idIndex < 0 || nameIndex < 0) {
    return { exists: true, changed: 0, scanned: 0, error: 'studentId/studentName column not found' };
  }

  let changed = 0;
  let scanned = 0;

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    if (!eapwqKp50Matches_(row, idIndex, groupIndex, sectionIndex)) continue;
    scanned += 1;

    const oldName = eapwqKp50Text_(row[nameIndex]);
    if (oldName === EAPWQ_KP50_FIX_NAME) continue;

    auditRows.push([
      stamp,
      sheetName,
      index + 1,
      'canonicalize_name',
      EAPWQ_KP50_FIX_ID,
      oldName,
      JSON.stringify({ studentId: EAPWQ_KP50_FIX_ID, studentName: oldName }),
      JSON.stringify({ studentId: EAPWQ_KP50_FIX_ID, studentName: EAPWQ_KP50_FIX_NAME })
    ]);

    row[nameIndex] = EAPWQ_KP50_FIX_NAME;
    changed += 1;
  }

  if (changed) {
    sh.getRange(1, 1, values.length, headers.length).setValues(values);
  }

  return { exists: true, changed: changed, scanned: scanned };
}

function eapwqKp50Matches_(row, idIndex, groupIndex, sectionIndex) {
  const studentId = eapwqKp50Text_(row[idIndex]);
  if (studentId !== EAPWQ_KP50_FIX_ID) return false;

  const group = groupIndex >= 0 ? eapwqKp50Text_(row[groupIndex]) : '';
  const section = sectionIndex >= 0 ? eapwqKp50Text_(row[sectionIndex]) : '';

  return (!group || group === EAPWQ_KP50_FIX_SECTION) &&
    (!section || section === EAPWQ_KP50_FIX_SECTION);
}

function eapwqKp50AppendAudit_(ss, rows) {
  if (!rows.length) return;

  const headers = [
    'changedAt',
    'sheet',
    'rowNumber',
    'action',
    'studentId',
    'oldStudentName',
    'beforeJson',
    'afterJson'
  ];

  let sh = ss.getSheetByName(EAPWQ_KP50_FIX_AUDIT);
  if (!sh) {
    sh = ss.insertSheet(EAPWQ_KP50_FIX_AUDIT);
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function eapwqKp50Text_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function eapwqKp50Now_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");
}
