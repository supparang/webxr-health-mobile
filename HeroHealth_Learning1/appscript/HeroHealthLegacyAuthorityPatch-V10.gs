/**
 * HeroHealth Legacy Authority Patch V11 STRICT
 * Version: 2026-07-29-PRODUCTION-V11-STRICT-CERTIFICATE-EVIDENCE
 *
 * IMPORTANT
 * - Replace the previous V10 file with this whole file.
 * - Do not add another doGet(e) or doPost(e).
 * - progressPct=100 or completedCount=9 ALONE never grants a certificate.
 */

var HHV11_VERSION = '2026-07-29-PRODUCTION-V11-STRICT-CERTIFICATE-EVIDENCE';
var HHV11_REQUIRED = {
  hygiene: ['handwash', 'toothbrush'],
  nutrition: ['groups', 'goodjunk'],
  fitness: ['jumpduck', 'balance-hold']
};

function HHV11_text_(v) {
  return String(v == null ? '' : v).trim();
}

function HHV11_bool_(v) {
  if (v === true || v === 1) return true;
  var s = HHV11_text_(v).toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

function HHV11_num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function HHV11_json_(v) {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(HHV11_text_(v)); }
  catch (err) { return null; }
}

function HHV11_isSyntheticEvent_(row, payload) {
  var eventId = HHV11_text_(row.eventId || (payload && payload.eventId)).toUpperCase();
  var eventType = HHV11_text_(row.eventType || (payload && payload.eventType)).toLowerCase();
  var status = HHV11_text_(payload && payload.status).toLowerCase();
  return eventId.indexOf('HH-V10-RECONCILE-') === 0 ||
    eventId.indexOf('HH-V11-RECONCILE-') === 0 ||
    eventType === 'reconcile' ||
    status.indexOf('restored from hh_events') >= 0 ||
    status.indexOf('historical certificate restored') >= 0;
}

function HHV11_walkEvidence_(value, out, depth) {
  if (!value || typeof value !== 'object' || depth > 6) return;
  if (Array.isArray(value)) {
    value.slice(-100).forEach(function(item) {
      HHV11_walkEvidence_(item, out, depth + 1);
    });
    return;
  }

  var step = HHV11_text_(
    value.currentStep != null ? value.currentStep :
    value.nextStep != null ? value.nextStep : value.step
  ).toLowerCase();
  var status = HHV11_text_(value.status).toLowerCase();

  out.progressPct = Math.max(
    out.progressPct,
    HHV11_num_(value.progressPct),
    HHV11_num_(value.progressPercent),
    HHV11_num_(value.percent),
    HHV11_num_(value.completionPercent)
  );
  out.completedCount = Math.max(
    out.completedCount,
    HHV11_num_(value.completedCount),
    HHV11_num_(value.completedSteps),
    HHV11_num_(value.completeCount)
  );

  out.missionComplete = out.missionComplete ||
    HHV11_bool_(value.missionComplete) ||
    HHV11_bool_(value.courseComplete) ||
    HHV11_bool_(value.completedAll);

  out.explicitCertificate = out.explicitCertificate ||
    step === 'certificate' ||
    HHV11_bool_(value.certificate) ||
    HHV11_bool_(value.hasCertificate) ||
    HHV11_bool_(value.certificateIssued) ||
    status.indexOf('certificate') >= 0 ||
    status.indexOf('ใบประกาศ') >= 0;

  Object.keys(value).forEach(function(key) {
    var child = value[key];
    if (child && typeof child === 'object') {
      HHV11_walkEvidence_(child, out, depth + 1);
    }
  });
}

function HHV11_historicalEvidence_(ss, studentId) {
  var evidence = {
    progressPct: 0,
    completedCount: 0,
    missionComplete: false,
    explicitCertificate: false,
    eventCount: 0,
    sourceEventId: '',
    sourceClientTs: ''
  };

  var sheet = ss.getSheetByName(HH_SHEETS.events);
  if (!sheet || sheet.getLastRow() < 2) {
    evidence.strictComplete = false;
    return evidence;
  }

  sheetObjects_(sheet).forEach(function(row) {
    if (cleanStudentId_(row.studentId) !== cleanStudentId_(studentId)) return;
    var payload = HHV11_json_(row.payloadJson);
    if (!payload || HHV11_isSyntheticEvent_(row, payload)) return;

    var beforeExplicit = evidence.explicitCertificate;
    var beforeMission = evidence.missionComplete;
    var beforePct = evidence.progressPct;
    var beforeCount = evidence.completedCount;

    HHV11_walkEvidence_(payload, evidence, 0);
    evidence.eventCount++;

    if ((!beforeExplicit && evidence.explicitCertificate) ||
        (!beforeMission && evidence.missionComplete) ||
        evidence.progressPct > beforePct ||
        evidence.completedCount > beforeCount) {
      evidence.sourceEventId = HHV11_text_(row.eventId);
      evidence.sourceClientTs = HHV11_text_(row.clientTs || row.serverTs);
    }
  });

  // STRICT RULE:
  // 1) explicit certificate evidence, OR
  // 2) missionComplete=true WITH corroborating 100% or 9 completed steps.
  evidence.strictComplete = evidence.explicitCertificate === true ||
    (evidence.missionComplete === true &&
      (evidence.progressPct >= 100 || evidence.completedCount >= 9));

  return evidence;
}

function HHV11_forceComplete_(authority, studentId, evidence) {
  if (!authority || !evidence || evidence.strictComplete !== true) return authority;

  authority.completed = authority.completed || {};
  authority.completed.pretest = true;
  authority.completed.hygiene = true;
  authority.completed.nutrition = true;
  authority.completed.fitness = true;
  authority.completed.posttest = true;
  authority.completed.reflection = true;
  authority.completed.gameSummary = true;

  authority.gameCompleted = authority.gameCompleted || {};
  Object.keys(HHV11_REQUIRED).forEach(function(zone) {
    authority.gameCompleted[zone] = authority.gameCompleted[zone] || {};
    HHV11_REQUIRED[zone].forEach(function(gameId) {
      authority.gameCompleted[zone][gameId] = true;
    });
  });

  authority.progress = {
    progressPct: 100,
    completedCount: 9,
    totalSteps: 9,
    nextStep: 'certificate',
    missionComplete: true
  };

  authority.authoritativeState = authority.authoritativeState || {};
  authority.authoritativeState.completed = authority.completed;
  authority.authoritativeState.gameCompleted = authority.gameCompleted;
  authority.authoritativeState.progress = authority.progress;
  authority.authoritativeState.sheetAuthority = true;
  authority.authoritativeState.legacyVerified = true;
  authority.authoritativeState.legacySource = 'HH_Events strict certificate evidence';
  authority.authoritativeState.legacyEvidence = evidence;

  authority.live = authority.live || {};
  authority.live.studentId = cleanStudentId_(studentId);
  authority.live.currentStep = 'certificate';
  authority.live.status = 'Restored from strict historical certificate evidence';
  authority.live.progressPct = 100;
  authority.live.completedCount = 9;
  authority.live.missionComplete = true;

  authority.legacyVerified = true;
  authority.legacyMigrated = true;
  authority.legacySource = 'HH_Events strict certificate evidence';
  authority.legacyEvidence = evidence;
  authority.version = HHV11_VERSION;
  return authority;
}

// Capture the original receiver builder before replacing it.
var HHV11_originalBuildStudentAuthority_ = buildStudentAuthority_;

buildStudentAuthority_ = function(ss, studentId) {
  var authority = HHV11_originalBuildStudentAuthority_(ss, studentId);
  var evidence = HHV11_historicalEvidence_(ss, studentId);
  return HHV11_forceComplete_(authority, studentId, evidence);
};

function HHV11_cleanSyntheticLive_(ss, studentId) {
  var sheet = ss.getSheetByName(HH_SHEETS.live);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(v) { return HHV11_text_(v); });
  var idxStudent = headers.indexOf('studentId');
  var idxStatus = headers.indexOf('status');
  var idxEvent = headers.indexOf('lastEventId');
  if (idxEvent < 0) idxEvent = headers.indexOf('eventId');
  var removed = 0;

  for (var r = values.length - 1; r >= 1; r--) {
    if (cleanStudentId_(values[r][idxStudent]) !== cleanStudentId_(studentId)) continue;
    var status = idxStatus >= 0 ? HHV11_text_(values[r][idxStatus]).toLowerCase() : '';
    var eventId = idxEvent >= 0 ? HHV11_text_(values[r][idxEvent]).toUpperCase() : '';
    var synthetic = status.indexOf('restored from hh_events') >= 0 ||
      status.indexOf('historical certificate restored') >= 0 ||
      eventId.indexOf('HH-V10-RECONCILE-') === 0 ||
      eventId.indexOf('HH-V11-RECONCILE-') === 0;
    if (synthetic) {
      sheet.deleteRow(r + 1);
      removed++;
    }
  }
  return removed;
}

function HHV11_reconcileStudent(studentId) {
  var sid = cleanStudentId_(studentId);
  if (!sid) throw new Error('missing_studentId');
  var ss = getHHSpreadsheet_();
  var evidence = HHV11_historicalEvidence_(ss, sid);

  // Remove only synthetic V10/V11 live rows. Genuine evidence remains untouched.
  var removedSyntheticRows = HHV11_cleanSyntheticLive_(ss, sid);
  var baseAuthority = HHV11_originalBuildStudentAuthority_(ss, sid);
  var authority = HHV11_forceComplete_(baseAuthority, sid, evidence);

  updateLiveFromAuthority_(ss, {
    studentId: sid,
    eventId: 'HH-V11-RECONCILE-' + sid + '-' + Date.now(),
    eventType: 'reconcile',
    status: evidence.strictComplete
      ? 'Strict historical certificate restored'
      : 'Rebuilt from genuine current Sheet evidence',
    profile: authority.profile ||
      (authority.authoritativeState && authority.authoritativeState.profile) || {}
  }, authority);

  SpreadsheetApp.flush();
  return {
    ok: true,
    studentId: sid,
    version: HHV11_VERSION,
    strictCertificateEvidence: evidence.strictComplete === true,
    removedSyntheticRows: removedSyntheticRows,
    progress: authority.progress,
    live: authority.live,
    evidence: evidence
  };
}

function HHV11_repair_990010() {
  var result = HHV11_reconcileStudent('990010');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function HHV11_reconcileAllStrict() {
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
    try { return HHV11_reconcileStudent(sid); }
    catch (err) {
      return { ok: false, studentId: sid, error: String(err && err.message || err) };
    }
  });

  var out = {
    ok: true,
    version: HHV11_VERSION,
    count: results.length,
    strictRestored: results.filter(function(r) {
      return r.strictCertificateEvidence === true;
    }).length,
    repairedSynthetic: results.filter(function(r) {
      return Number(r.removedSyntheticRows || 0) > 0;
    }).length,
    results: results
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// Compatibility aliases so old menu names do not silently run the unsafe V10 logic.
function HHV10_reconcileStudent(studentId) { return HHV11_reconcileStudent(studentId); }
function HHV10_reconcileAll() { return HHV11_reconcileAllStrict(); }
function HHV10_run_reconcileAll() { return HHV11_reconcileAllStrict(); }
