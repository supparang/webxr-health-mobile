/**
 * HeroHealth Legacy Live Repair V11.1
 * Version: 2026-07-29-PRODUCTION-V11.1-STALE-LIVE-CERTIFICATE-REPAIR
 *
 * Add this file to the SAME Apps Script project after the V11 Strict patch.
 * Do not add doGet(e) or doPost(e).
 *
 * Purpose:
 * - Fix students such as 990010 where the canonical progress is 33%,
 *   but HH_Live_Status still says certificate / 100% / missionComplete=true.
 * - HH_Live_Status is a derived cache, so stale rows may be safely rebuilt.
 */

var HHV111_VERSION = '2026-07-29-PRODUCTION-V11.1-STALE-LIVE-CERTIFICATE-REPAIR';

function HHV111_text_(v) {
  return String(v == null ? '' : v).trim();
}

function HHV111_bool_(v) {
  if (v === true || v === 1) return true;
  var s = HHV111_text_(v).toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

/**
 * Delete every HH_Live_Status row for one student.
 * Live status is derived from authoritative sheets and will be recreated.
 */
function HHV111_deleteStudentLiveRows_(ss, studentId) {
  var sheet = ss.getSheetByName(HH_SHEETS.live);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(v) { return HHV111_text_(v); });
  var idxStudent = headers.indexOf('studentId');
  if (idxStudent < 0) throw new Error('HH_Live_Status missing studentId header');

  var sid = cleanStudentId_(studentId);
  var removed = 0;

  for (var r = values.length - 1; r >= 1; r--) {
    if (cleanStudentId_(values[r][idxStudent]) === sid) {
      sheet.deleteRow(r + 1);
      removed++;
    }
  }

  return removed;
}

/**
 * Build a clean live object from the canonical progress returned by
 * the original receiver authority builder.
 */
function HHV111_cleanLiveFromAuthority_(studentId, authority) {
  var p = authority.progress ||
    (authority.authoritativeState && authority.authoritativeState.progress) || {};
  var profile = authority.profile ||
    (authority.authoritativeState && authority.authoritativeState.profile) || {};

  return {
    studentId: cleanStudentId_(studentId),
    fullName: HHV111_text_(profile.fullName || profile.studentName || profile.name),
    section: HHV111_text_(profile.section),
    group: HHV111_text_(profile.group || authority.group),
    currentStep: HHV111_text_(p.nextStep || 'pretest'),
    status: 'Rebuilt from genuine current Sheet evidence',
    progressPct: Number(p.progressPct || 0),
    completedCount: Number(p.completedCount || 0),
    missionComplete: p.missionComplete === true
  };
}

/**
 * Repair one student.
 * Certificate is retained only when V11 strict historical evidence is true.
 */
function HHV111_repairStudent(studentId) {
  var sid = cleanStudentId_(studentId);
  if (!sid) throw new Error('missing_studentId');

  var ss = getHHSpreadsheet_();
  var evidence = HHV11_historicalEvidence_(ss, sid);

  // Start from the receiver's genuine current evidence, bypassing V10/V11 override.
  var baseAuthority = HHV11_originalBuildStudentAuthority_(ss, sid);
  var authority;

  if (evidence.strictComplete === true) {
    authority = HHV11_forceComplete_(baseAuthority, sid, evidence);
  } else {
    authority = baseAuthority;
    authority.legacyVerified = false;
    authority.legacyMigrated = false;
    authority.legacySource = '';
    authority.legacyEvidence = evidence;

    if (authority.authoritativeState) {
      authority.authoritativeState.legacyVerified = false;
      authority.authoritativeState.legacySource = '';
      authority.authoritativeState.legacyEvidence = evidence;
    }

    authority.live = HHV111_cleanLiveFromAuthority_(sid, authority);
  }

  // Remove stale max-preserved live rows before rebuilding.
  var removedLiveRows = HHV111_deleteStudentLiveRows_(ss, sid);

  var cleanLive = authority.live || HHV111_cleanLiveFromAuthority_(sid, authority);
  authority.live = cleanLive;

  updateLiveFromAuthority_(
    ss,
    {
      studentId: sid,
      eventId: 'HH-V11-1-LIVE-REPAIR-' + sid + '-' + Date.now(),
      eventType: 'live_repair',
      status: cleanLive.status,
      profile: authority.profile ||
        (authority.authoritativeState && authority.authoritativeState.profile) || {}
    },
    authority
  );

  SpreadsheetApp.flush();

  var result = {
    ok: true,
    studentId: sid,
    version: HHV111_VERSION,
    strictCertificateEvidence: evidence.strictComplete === true,
    removedLiveRows: removedLiveRows,
    progress: authority.progress ||
      (authority.authoritativeState && authority.authoritativeState.progress) || null,
    live: authority.live,
    evidence: evidence
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function HHV111_repair_990010() {
  return HHV111_repairStudent('990010');
}

function HHV111_verify_990001() {
  return HHV111_repairStudent('990001');
}

function HHV111_repairAll() {
  var ss = getHHSpreadsheet_();
  var ids = {};

  Object.keys(HH_SHEETS).forEach(function(key) {
    var sheet = ss.getSheetByName(HH_SHEETS[key]);
    if (!sheet) return;
    sheetObjects_(sheet).forEach(function(row) {
      var sid = cleanStudentId_(row.studentId);
      if (sid) ids[sid] = true;
    });
  });

  var results = Object.keys(ids).sort().map(function(sid) {
    try {
      return HHV111_repairStudent(sid);
    } catch (err) {
      return {
        ok: false,
        studentId: sid,
        error: String(err && err.message || err)
      };
    }
  });

  var out = {
    ok: true,
    version: HHV111_VERSION,
    count: results.length,
    strictCertificates: results.filter(function(r) {
      return r.strictCertificateEvidence === true;
    }).length,
    repaired: results.filter(function(r) {
      return r.ok === true && Number(r.removedLiveRows || 0) > 0;
    }).length,
    results: results
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
