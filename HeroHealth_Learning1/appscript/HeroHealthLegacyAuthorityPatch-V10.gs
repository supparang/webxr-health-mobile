/**
 * HeroHealth Legacy Authority Patch V10
 * Version: 2026-07-29-PRODUCTION-V10-HISTORICAL-MAX-EVENT-AUTHORITY
 *
 * Purpose
 * - Preserve the highest historical progress found in HH_Events payloadJson.
 * - Restore certificate holders even when newer HH_Live_Status / HH_Progress rows are 0%.
 * - Do not declare doGet(e) or doPost(e).
 *
 * Usage in the Apps Script project
 * 1) Add this file to the SAME project as HeroHealthClassroomReceiver-R31.gs.
 * 2) Keep only one doGet(e) and doPost(e), from the receiver file.
 * 3) Save, run HHV10_reconcileStudent('990001') once, then deploy a NEW Web app version.
 */

var HHV10_VERSION = '2026-07-29-PRODUCTION-V10-HISTORICAL-MAX-EVENT-AUTHORITY';
var HHV10_REQUIRED = {
  hygiene: ['handwash', 'toothbrush'],
  nutrition: ['groups', 'goodjunk'],
  fitness: ['jumpduck', 'balance-hold']
};

function HHV10_text_(v) {
  return String(v == null ? '' : v).trim();
}

function HHV10_bool_(v) {
  if (v === true || v === 1) return true;
  var s = HHV10_text_(v).toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

function HHV10_num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function HHV10_json_(v) {
  if (v && typeof v === 'object') return v;
  try {
    return JSON.parse(HHV10_text_(v));
  } catch (err) {
    return null;
  }
}

function HHV10_walkEvidence_(value, out, depth) {
  if (!value || typeof value !== 'object' || depth > 6) return;

  if (Array.isArray(value)) {
    value.slice(-100).forEach(function(item) {
      HHV10_walkEvidence_(item, out, depth + 1);
    });
    return;
  }

  var step = HHV10_text_(
    value.currentStep != null ? value.currentStep :
    value.nextStep != null ? value.nextStep :
    value.step
  ).toLowerCase();

  out.progressPct = Math.max(
    out.progressPct,
    HHV10_num_(value.progressPct),
    HHV10_num_(value.progressPercent),
    HHV10_num_(value.percent),
    HHV10_num_(value.completionPercent)
  );

  out.completedCount = Math.max(
    out.completedCount,
    HHV10_num_(value.completedCount),
    HHV10_num_(value.completedSteps),
    HHV10_num_(value.completeCount)
  );

  out.missionComplete = out.missionComplete ||
    HHV10_bool_(value.missionComplete) ||
    HHV10_bool_(value.courseComplete) ||
    HHV10_bool_(value.completedAll);

  out.certificate = out.certificate ||
    step === 'certificate' ||
    HHV10_bool_(value.certificate) ||
    HHV10_bool_(value.hasCertificate) ||
    HHV10_bool_(value.certificateEligible) ||
    HHV10_text_(value.status).toLowerCase().indexOf('certificate') >= 0 ||
    HHV10_text_(value.status).indexOf('ใบประกาศ') >= 0;

  Object.keys(value).forEach(function(key) {
    var child = value[key];
    if (child && typeof child === 'object') {
      HHV10_walkEvidence_(child, out, depth + 1);
    }
  });
}

function HHV10_historicalEvidence_(ss, studentId) {
  var evidence = {
    progressPct: 0,
    completedCount: 0,
    missionComplete: false,
    certificate: false,
    eventCount: 0,
    sourceEventId: '',
    sourceClientTs: ''
  };

  var sheet = ss.getSheetByName(HH_SHEETS.events);
  if (!sheet || sheet.getLastRow() < 2) return evidence;

  var rows = sheetObjects_(sheet);

  rows.forEach(function(row) {
    if (cleanStudentId_(row.studentId) !== cleanStudentId_(studentId)) return;

    var payload = HHV10_json_(row.payloadJson);
    if (!payload) return;

    var beforePct = evidence.progressPct;
    var beforeCount = evidence.completedCount;
    var beforeComplete = evidence.missionComplete;
    var beforeCertificate = evidence.certificate;

    HHV10_walkEvidence_(payload, evidence, 0);
    evidence.eventCount++;

    if (
      evidence.progressPct > beforePct ||
      evidence.completedCount > beforeCount ||
      (!beforeComplete && evidence.missionComplete) ||
      (!beforeCertificate && evidence.certificate)
    ) {
      evidence.sourceEventId = HHV10_text_(row.eventId);
      evidence.sourceClientTs = HHV10_text_(row.clientTs || row.serverTs);
    }
  });

  evidence.completeEvidence =
    evidence.certificate ||
    evidence.missionComplete ||
    evidence.progressPct >= 100 ||
    evidence.completedCount >= 9;

  return evidence;
}

function HHV10_forceComplete_(authority, studentId, evidence) {
  if (!authority || !evidence || evidence.completeEvidence !== true) {
    return authority;
  }

  authority.completed = authority.completed || {};
  authority.completed.pretest = true;
  authority.completed.hygiene = true;
  authority.completed.nutrition = true;
  authority.completed.fitness = true;
  authority.completed.posttest = true;
  authority.completed.reflection = true;
  authority.completed.gameSummary = true;

  authority.gameCompleted = authority.gameCompleted || {};
  Object.keys(HHV10_REQUIRED).forEach(function(zone) {
    authority.gameCompleted[zone] = authority.gameCompleted[zone] || {};
    HHV10_REQUIRED[zone].forEach(function(gameId) {
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
  authority.authoritativeState.legacySource = 'HH_Events historical max';
  authority.authoritativeState.legacyEvidence = evidence;

  authority.live = authority.live || {};
  authority.live.studentId = cleanStudentId_(studentId);
  authority.live.currentStep = 'certificate';
  authority.live.status = 'Restored from HH_Events historical certificate evidence';
  authority.live.progressPct = 100;
  authority.live.completedCount = 9;
  authority.live.missionComplete = true;

  authority.legacyVerified = true;
  authority.legacyMigrated = true;
  authority.legacySource = 'HH_Events historical max';
  authority.legacyEvidence = evidence;
  authority.version = HHV10_VERSION;

  return authority;
}

/**
 * Wrapper around the existing receiver authority builder.
 * This assignment intentionally does not redeclare doGet/doPost.
 */
var HHV10_originalBuildStudentAuthority_ = buildStudentAuthority_;

buildStudentAuthority_ = function(ss, studentId) {
  var authority = HHV10_originalBuildStudentAuthority_(ss, studentId);
  var evidence = HHV10_historicalEvidence_(ss, studentId);
  return HHV10_forceComplete_(authority, studentId, evidence);
};

function HHV10_reconcileStudent(studentId) {
  var sid = cleanStudentId_(studentId);
  if (!sid) throw new Error('missing_studentId');

  var ss = getHHSpreadsheet_();
  var authority = buildStudentAuthority_(ss, sid);

  updateLiveFromAuthority_(
    ss,
    {
      studentId: sid,
      eventId: 'HH-V10-RECONCILE-' + sid + '-' + Date.now(),
      eventType: 'reconcile',
      status: authority.legacyVerified
        ? 'Historical certificate restored from HH_Events'
        : 'Reconciled from current Sheet evidence',
      profile: authority.profile ||
        (authority.authoritativeState && authority.authoritativeState.profile) ||
        {}
    },
    authority
  );

  SpreadsheetApp.flush();

  return {
    ok: true,
    studentId: sid,
    version: HHV10_VERSION,
    legacyVerified: authority.legacyVerified === true,
    legacySource: authority.legacySource || '',
    progress: authority.progress,
    live: authority.live,
    evidence: authority.legacyEvidence || null
  };
}

function HHV10_reconcileAll() {
  var ss = getHHSpreadsheet_();
  var ids = {};

  Object.values(HH_SHEETS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheetObjects_(sheet).forEach(function(row) {
      var sid = cleanStudentId_(row.studentId);
      if (sid) ids[sid] = true;
    });
  });

  var studentIds = Object.keys(ids).sort();
  var results = studentIds.map(function(sid) {
    try {
      return HHV10_reconcileStudent(sid);
    } catch (err) {
      return { ok: false, studentId: sid, error: String(err && err.message || err) };
    }
  });

  return {
    ok: true,
    version: HHV10_VERSION,
    count: results.length,
    restored: results.filter(function(r) { return r.legacyVerified === true; }).length,
    results: results
  };
}
