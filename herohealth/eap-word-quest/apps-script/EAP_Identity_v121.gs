/* =========================================================
   EAP Unified Identity Authority v121
   Canonical roster for EAP Hero + EAP Word Quest.

   Lookup order
   1. eap_word_roster       official roster
   2. eap_identity_map      alias -> canonical identity
   3. profiles              legacy Hero fallback only
========================================================= */

var EAP_IDENTITY_V121 = '20260802-EAP-IDENTITY-V121-CANONICAL-ROSTER';
var EAP_IDENTITY_ROSTER_SHEET_V121 = 'eap_word_roster';
var EAP_IDENTITY_MAP_SHEET_V121 = 'eap_identity_map';
var EAP_IDENTITY_LEGACY_SHEET_V121 = 'profiles';

function eapIdentityTextV121_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function eapIdentitySpreadsheetV121_() {
  if (typeof ss_ === 'function') return ss_();
  return SpreadsheetApp.getActive();
}

function eapIdentityHeaderMapV121_(headers) {
  var map = {};
  (headers || []).forEach(function(header, index) {
    map[eapIdentityTextV121_(header).toLowerCase()] = index;
  });
  return map;
}

function eapIdentityPickV121_(row, map, names) {
  for (var i = 0; i < names.length; i += 1) {
    var index = map[String(names[i]).toLowerCase()];
    if (index !== undefined) {
      var value = eapIdentityTextV121_(row[index]);
      if (value) return value;
    }
  }
  return '';
}

function eapIdentityRowsV121_(sheetName) {
  var sheet = eapIdentitySpreadsheetV121_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return { sheet: sheet, headers: [], map: {}, rows: [] };
  }
  var values = sheet.getDataRange().getDisplayValues();
  return {
    sheet: sheet,
    headers: values[0],
    map: eapIdentityHeaderMapV121_(values[0]),
    rows: values.slice(1)
  };
}

function eapIdentityRosterLookupV121_(studentId, section) {
  var data = eapIdentityRowsV121_(EAP_IDENTITY_ROSTER_SHEET_V121);
  for (var i = 0; i < data.rows.length; i += 1) {
    var row = data.rows[i];
    var id = eapIdentityPickV121_(row, data.map, ['studentId', 'student_id', 'id']);
    var rowSection = eapIdentityPickV121_(row, data.map, ['section', 'group', 'classGroup']);
    var status = eapIdentityPickV121_(row, data.map, ['status']);
    if (id === studentId && (!section || rowSection === section)) {
      if (status && !/^(active|enabled|current|true|1)$/i.test(status)) continue;
      return {
        canonicalStudentId: id,
        studentName: eapIdentityPickV121_(row, data.map, ['studentName', 'student_name', 'name']),
        section: rowSection || section,
        status: status || 'active',
        email: eapIdentityPickV121_(row, data.map, ['email']),
        sourceSheet: EAP_IDENTITY_ROSTER_SHEET_V121,
        sourceRow: i + 2
      };
    }
  }
  return null;
}

function eapIdentityMapLookupV121_(requestedId, section) {
  var data = eapIdentityRowsV121_(EAP_IDENTITY_MAP_SHEET_V121);
  for (var i = 0; i < data.rows.length; i += 1) {
    var row = data.rows[i];
    var alias = eapIdentityPickV121_(row, data.map, [
      'aliasId', 'alias', 'sourceId', 'legacyId', 'shortId', 'studentId'
    ]);
    var rowSection = eapIdentityPickV121_(row, data.map, ['section', 'group', 'classGroup']);
    if (alias !== requestedId || (section && rowSection && rowSection !== section)) continue;

    var canonical = eapIdentityPickV121_(row, data.map, [
      'canonicalStudentId', 'canonicalId', 'targetStudentId', 'officialStudentId', 'mappedStudentId'
    ]);
    var name = eapIdentityPickV121_(row, data.map, ['studentName', 'student_name', 'name']);

    if (canonical) {
      var roster = eapIdentityRosterLookupV121_(canonical, rowSection || section);
      if (roster) {
        roster.aliasStudentId = requestedId;
        roster.identitySource = EAP_IDENTITY_MAP_SHEET_V121 + '->' + roster.sourceSheet;
        return roster;
      }
    }

    if (name) {
      return {
        canonicalStudentId: canonical || requestedId,
        aliasStudentId: requestedId,
        studentName: name,
        section: rowSection || section,
        status: eapIdentityPickV121_(row, data.map, ['status']) || 'active',
        sourceSheet: EAP_IDENTITY_MAP_SHEET_V121,
        sourceRow: i + 2
      };
    }
  }
  return null;
}

function eapIdentityLegacyLookupV121_(studentId, section) {
  var data = eapIdentityRowsV121_(EAP_IDENTITY_LEGACY_SHEET_V121);
  for (var i = 0; i < data.rows.length; i += 1) {
    var row = data.rows[i];
    var id = eapIdentityPickV121_(row, data.map, ['studentId', 'student_id', 'id']);
    var rowSection = eapIdentityPickV121_(row, data.map, ['section', 'group']);
    if (id === studentId && (!section || rowSection === section)) {
      return {
        canonicalStudentId: id,
        studentName: eapIdentityPickV121_(row, data.map, ['studentName', 'student_name', 'name']),
        section: rowSection || section,
        status: 'legacy',
        sourceSheet: EAP_IDENTITY_LEGACY_SHEET_V121,
        sourceRow: i + 2,
        legacyFallback: true
      };
    }
  }
  return null;
}

function eapIdentityLookupV121_(params) {
  params = params || {};
  var startedAt = Date.now();
  var requestedId = eapIdentityTextV121_(
    params.studentId || params.student_id || params.playerId || params.id
  );
  var section = eapIdentityTextV121_(params.section || '122') || '122';

  if (!requestedId) {
    return {
      ok: false,
      found: false,
      identityFound: false,
      version: EAP_IDENTITY_V121,
      error: 'studentId is required'
    };
  }

  var identity = eapIdentityRosterLookupV121_(requestedId, section);
  if (!identity) identity = eapIdentityMapLookupV121_(requestedId, section);
  if (!identity) identity = eapIdentityLegacyLookupV121_(requestedId, section);

  if (!identity || !identity.studentName) {
    return {
      ok: true,
      found: false,
      identityFound: false,
      version: EAP_IDENTITY_V121,
      requestedStudentId: requestedId,
      studentId: requestedId,
      section: section,
      authoritySheet: EAP_IDENTITY_ROSTER_SHEET_V121,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt
    };
  }

  return {
    ok: true,
    found: true,
    identityFound: true,
    version: EAP_IDENTITY_V121,
    service: 'eap-unified-identity',
    requestedStudentId: requestedId,
    aliasStudentId: identity.aliasStudentId || '',
    canonicalStudentId: identity.canonicalStudentId,
    studentId: identity.canonicalStudentId,
    studentName: identity.studentName,
    section: identity.section || section,
    status: identity.status || 'active',
    email: identity.email || '',
    sourceSheet: identity.sourceSheet,
    identitySource: identity.identitySource || identity.sourceSheet,
    sourceRow: identity.sourceRow || '',
    legacyFallback: identity.legacyFallback === true,
    checkedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt
  };
}
