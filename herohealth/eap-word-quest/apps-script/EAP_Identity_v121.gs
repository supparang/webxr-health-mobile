/* =========================================================
   EAP Unified Identity Authority v123 FAST ROSTER
   File: EAP_Identity_v121.gs

   Canonical identity for EAP Hero + EAP Word Quest.

   PRODUCTION RULE
   - eap_word_roster is the ONLY identity authority.
   - Use the SAME spreadsheet resolver as EAP Word Quest first.
   - No identity_map fallback.
   - No profiles fallback.
   - studentId + section are the identity key.
   - Name is display data only.
   - Script Cache keeps a compact roster index for fast mobile lookup.

   Router compatibility
   - Keep eapIdentityLookupV121_(params) so SharedWebAppRouter.gs
     does not need a breaking route change.
========================================================= */

var EAP_IDENTITY_V121 = '20260810-EAP-IDENTITY-V123-WORD-QUEST-SPREADSHEET-AUTHORITY';
var EAP_IDENTITY_ROSTER_SHEET_V121 = 'eap_word_roster';
var EAP_IDENTITY_CACHE_KEY_V122 = 'EAP_IDENTITY_ROSTER_INDEX_V123';
var EAP_IDENTITY_CACHE_SECONDS_V122 = 300;

function eapIdentityTextV121_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

/*
 * IMPORTANT: Web App executions must not rely on SpreadsheetApp.getActive()
 * when the canonical Word Quest spreadsheet id is already available.
 * Reuse the proven Word Quest resolver first so Hero + Vocabulary always read
 * the same physical roster spreadsheet.
 */
function eapIdentitySpreadsheetV121_() {
  if (typeof eapwqaSpreadsheet_ === 'function') {
    return eapwqaSpreadsheet_();
  }

  try {
    var props = PropertiesService.getScriptProperties();
    var id = eapIdentityTextV121_(props.getProperty('EAPWQ_SPREADSHEET_ID'));
    if (id) return SpreadsheetApp.openById(id);
  } catch (ignore) {}

  if (typeof ss_ === 'function') {
    var viaHero = ss_();
    if (viaHero) return viaHero;
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  throw new Error('EAP roster spreadsheet is unavailable: EAPWQ_SPREADSHEET_ID is not configured');
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

function eapIdentityKeyV122_(studentId, section) {
  return eapIdentityTextV121_(section || '122') + '|' + eapIdentityTextV121_(studentId);
}

function eapIdentityStatusActiveV122_(status) {
  var value = eapIdentityTextV121_(status);
  if (!value) return true;
  return /^(active|enabled|current|true|1)$/i.test(value);
}

function eapIdentityBuildRosterIndexV122_() {
  var startedAt = Date.now();
  var ss = eapIdentitySpreadsheetV121_();
  var sheet = ss.getSheetByName(EAP_IDENTITY_ROSTER_SHEET_V121);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      ok: true,
      version: EAP_IDENTITY_V121,
      spreadsheetId: ss.getId(),
      builtAt: new Date().toISOString(),
      buildMs: Date.now() - startedAt,
      count: 0,
      rows: {}
    };
  }

  var lastRow = sheet.getLastRow();
  var lastColumn = Math.max(1, sheet.getLastColumn());
  var values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  var map = eapIdentityHeaderMapV121_(values[0] || []);
  var rows = {};

  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    var studentId = eapIdentityPickV121_(row, map, ['studentId', 'student_id', 'id']);
    if (!studentId) continue;

    var section = eapIdentityPickV121_(row, map, ['section', 'group', 'classGroup']) || '122';
    var status = eapIdentityPickV121_(row, map, ['status']);
    if (!eapIdentityStatusActiveV122_(status)) continue;

    var studentName = eapIdentityPickV121_(row, map, ['studentName', 'student_name', 'name']);
    if (!studentName) continue;

    rows[eapIdentityKeyV122_(studentId, section)] = {
      studentId: studentId,
      studentName: studentName,
      section: section,
      status: status || 'active',
      email: eapIdentityPickV121_(row, map, ['email']),
      sourceRow: i + 1
    };
  }

  return {
    ok: true,
    version: EAP_IDENTITY_V121,
    spreadsheetId: ss.getId(),
    builtAt: new Date().toISOString(),
    buildMs: Date.now() - startedAt,
    count: Object.keys(rows).length,
    rows: rows
  };
}

function eapIdentityRosterIndexV122_(forceRefresh) {
  var cache = CacheService.getScriptCache();

  if (!forceRefresh) {
    try {
      var cached = cache.get(EAP_IDENTITY_CACHE_KEY_V122);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.rows) {
          parsed.cacheHit = true;
          return parsed;
        }
      }
    } catch (ignore) {}
  }

  var index = eapIdentityBuildRosterIndexV122_();
  index.cacheHit = false;

  try {
    cache.put(
      EAP_IDENTITY_CACHE_KEY_V122,
      JSON.stringify(index),
      EAP_IDENTITY_CACHE_SECONDS_V122
    );
  } catch (ignore) {}

  return index;
}

function eapIdentityLookupV121_(params) {
  params = params || {};
  var startedAt = Date.now();

  var requestedId = eapIdentityTextV121_(
    params.studentId || params.student_id || params.playerId || params.id
  );
  var section = eapIdentityTextV121_(params.section || '122') || '122';
  var forceRefresh = String(params.force || '').toLowerCase() === '1' ||
    String(params.force || '').toLowerCase() === 'true';

  if (!requestedId) {
    return {
      ok: false,
      found: false,
      identityFound: false,
      service: 'eap-unified-identity-fast',
      version: EAP_IDENTITY_V121,
      error: 'studentId is required',
      elapsedMs: Date.now() - startedAt
    };
  }

  var index = eapIdentityRosterIndexV122_(forceRefresh);
  var identity = (index.rows || {})[eapIdentityKeyV122_(requestedId, section)] || null;

  if (!identity) {
    return {
      ok: true,
      found: false,
      identityFound: false,
      service: 'eap-unified-identity-fast',
      version: EAP_IDENTITY_V121,
      requestedStudentId: requestedId,
      studentId: requestedId,
      section: section,
      authoritySheet: EAP_IDENTITY_ROSTER_SHEET_V121,
      spreadsheetId: index.spreadsheetId || '',
      rosterCount: index.count || 0,
      cacheHit: index.cacheHit === true,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt
    };
  }

  return {
    ok: true,
    found: true,
    identityFound: true,
    service: 'eap-unified-identity-fast',
    version: EAP_IDENTITY_V121,
    requestedStudentId: requestedId,
    aliasStudentId: '',
    canonicalStudentId: identity.studentId,
    studentId: identity.studentId,
    studentName: identity.studentName,
    section: identity.section || section,
    status: identity.status || 'active',
    email: identity.email || '',
    sourceSheet: EAP_IDENTITY_ROSTER_SHEET_V121,
    identitySource: EAP_IDENTITY_ROSTER_SHEET_V121,
    spreadsheetId: index.spreadsheetId || '',
    sourceRow: identity.sourceRow || '',
    legacyFallback: false,
    rosterCount: index.count || 0,
    cacheHit: index.cacheHit === true,
    checkedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt
  };
}

function eapIdentityClearRosterCacheV122() {
  CacheService.getScriptCache().remove(EAP_IDENTITY_CACHE_KEY_V122);
  return {
    ok: true,
    version: EAP_IDENTITY_V121,
    cleared: true,
    cacheKey: EAP_IDENTITY_CACHE_KEY_V122
  };
}
