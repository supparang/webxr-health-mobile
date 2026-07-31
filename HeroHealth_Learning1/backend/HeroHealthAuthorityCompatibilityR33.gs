/**
 * HeroHealth Authority Compatibility Bridge R33
 * Safe add-on for mixed Receiver V9/R31 + legacy authority projects.
 *
 * IMPORTANT
 * - This file declares NO doGet(e) and NO doPost(e).
 * - It only restores the HHV9_* names expected by the deployed Receiver.
 * - Google Sheet remains the sole authority.
 */

function HHV9_buildStudentAuthority_(ss, sid) {
  var studentId = cleanStudentId_(sid);
  if (!studentId) {
    return {ok:false, error:'missing_studentId', authority:'google_sheet', bridgeVersion:'R33'};
  }

  if (typeof HHV12_buildStudentAuthority_ === 'function') {
    return HHV12_buildStudentAuthority_(ss, studentId);
  }
  if (typeof HHV11_buildStudentAuthority_ === 'function') {
    return HHV11_buildStudentAuthority_(ss, studentId);
  }
  if (typeof buildStudentAuthority_ === 'function') {
    return buildStudentAuthority_(ss, studentId);
  }

  throw new Error('authority_builder_missing: expected HHV12_buildStudentAuthority_ or buildStudentAuthority_');
}

function HHV9_studentDebug_(ss, sid) {
  var studentId = cleanStudentId_(sid);
  var result = HHV9_buildStudentAuthority_(ss, studentId);
  return {
    ok: result && result.ok !== false,
    studentId: studentId,
    authority: 'google_sheet',
    bridgeVersion: '2026-07-31-R33-AUTHORITY-COMPATIBILITY',
    selectedBuilder: typeof HHV12_buildStudentAuthority_ === 'function'
      ? 'HHV12_buildStudentAuthority_'
      : (typeof HHV11_buildStudentAuthority_ === 'function'
        ? 'HHV11_buildStudentAuthority_'
        : 'buildStudentAuthority_'),
    authorityResult: result
  };
}

function HHV9_rebuildStudentLive_(sid) {
  var studentId = cleanStudentId_(sid);
  if (typeof HHV12_rebuildStudentLive_ === 'function') {
    return HHV12_rebuildStudentLive_(studentId);
  }
  if (typeof HH_rebuildStudentLive === 'function') {
    return HH_rebuildStudentLive(studentId);
  }
  if (typeof HH_rebuildStudentLive_ === 'function') {
    return HH_rebuildStudentLive_(studentId);
  }

  var ss = getHHSpreadsheet_();
  var authority = HHV9_buildStudentAuthority_(ss, studentId);
  return {
    ok: authority && authority.ok !== false,
    studentId: studentId,
    authority: 'google_sheet',
    reconciled: false,
    reason: 'live_rebuilder_not_present_authority_returned',
    authoritativeState: authority && (authority.authoritativeState || authority)
  };
}

function HHV9_rebuildAllLive_() {
  if (typeof HHV12_rebuildAllLive_ === 'function') {
    return HHV12_rebuildAllLive_();
  }
  if (typeof HH_rebuildAllLive === 'function') {
    return HH_rebuildAllLive();
  }
  if (typeof HH_rebuildAllLive_ === 'function') {
    return HH_rebuildAllLive_();
  }
  return {
    ok: true,
    authority: 'google_sheet',
    reconciled: false,
    reason: 'bulk_live_rebuilder_not_present',
    bridgeVersion: '2026-07-31-R33-AUTHORITY-COMPATIBILITY'
  };
}

function HH_R33_testAuthorityBridge(studentId) {
  var sid = cleanStudentId_(studentId || '990023');
  var ss = getHHSpreadsheet_();
  var result = HHV9_buildStudentAuthority_(ss, sid);
  return {
    ok: result && result.ok !== false,
    studentId: sid,
    bridgeVersion: '2026-07-31-R33-AUTHORITY-COMPATIBILITY',
    selectedBuilder: typeof HHV12_buildStudentAuthority_ === 'function'
      ? 'HHV12_buildStudentAuthority_'
      : (typeof HHV11_buildStudentAuthority_ === 'function'
        ? 'HHV11_buildStudentAuthority_'
        : (typeof buildStudentAuthority_ === 'function' ? 'buildStudentAuthority_' : 'NONE')),
    found: result && result.found,
    profile: result && result.profile,
    progress: result && result.progress,
    result: result
  };
}
