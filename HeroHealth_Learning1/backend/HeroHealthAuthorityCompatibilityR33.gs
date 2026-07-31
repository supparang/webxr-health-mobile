/**
 * HeroHealth Authority Compatibility Bridge R34
 * Complete helper set for mixed Receiver V9/R31 + Assessment Authority V10.
 *
 * IMPORTANT
 * - This file declares NO doGet(e) and NO doPost(e).
 * - It restores the HHV9_* helpers required by Assessment Authority V10.
 * - Google Sheet remains the sole authority.
 * - Do not add the full HeroHealthAuthorityV9.gs while this bridge is installed,
 *   unless duplicate HHV9_* declarations are removed first.
 */

var HH_AUTHORITY_COMPAT_R34 = '2026-07-31-R34-V10-DEPENDENCY-COMPLETE';

function HHV9_key_(v) {
  return String(v == null ? '' : v)
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\()\[\]]+/g, '');
}

function HHV9_pick_(row, aliases) {
  if (!row) return '';
  var map = {};
  Object.keys(row).forEach(function(k) {
    map[HHV9_key_(k)] = row[k];
  });
  for (var i = 0; i < aliases.length; i++) {
    var key = HHV9_key_(aliases[i]);
    if (
      Object.prototype.hasOwnProperty.call(map, key) &&
      map[key] !== '' &&
      map[key] != null
    ) return map[key];
  }
  return '';
}

function HHV9_normalizeAssessment_(v) {
  var x = HHV9_key_(v);
  if (x === 'pre' || x === 'pretest' || x === 'ก่อนเรียน' || x === 'แบบทดสอบก่อนเรียน') return 'pretest';
  if (x === 'post' || x === 'posttest' || x === 'หลังเรียน' || x === 'แบบทดสอบหลังเรียน') return 'posttest';
  return x;
}

function HHV9_sheetRows_(sh) {
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return [];
  var values = sh.getDataRange().getValues();
  var rawHeaders = values.shift();
  var headers = rawHeaders.map(function(h, i) {
    return String(h || ('column' + (i + 1))).trim();
  });
  return values
    .filter(function(row) {
      return row.some(function(value) { return value !== '' && value != null; });
    })
    .map(function(row, rowIndex) {
      var out = {__rowNumber: rowIndex + 2};
      headers.forEach(function(header, i) { out[header] = row[i]; });
      return out;
    });
}

function HHV9_studentIdFromRow_(row) {
  return cleanStudentId_(HHV9_pick_(row, [
    'studentId', 'student_id', 'student id', 'pid', 'sid',
    'รหัสนักเรียน', 'รหัส', 'เลขประจำตัวนักเรียน'
  ]));
}

function HHV9_rowsForStudent_(sh, sid) {
  var studentId = cleanStudentId_(sid);
  return HHV9_sheetRows_(sh).filter(function(row) {
    return HHV9_studentIdFromRow_(row) === studentId;
  });
}

function HHV9_assessmentType_(row) {
  var value = HHV9_pick_(row, [
    'assessment', 'assessmentType', 'assessment_type', 'type', 'mode',
    'testType', 'test_type', 'แบบทดสอบ', 'ประเภท'
  ]);
  if (!value) {
    var payload = HHV9_pick_(row, ['payloadJson', 'payload', 'json']);
    try {
      var parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      value = parsed && parsed.assessment &&
        (parsed.assessment.type || parsed.assessment.assessmentType) ||
        parsed && (parsed.assessmentType || parsed.type) || '';
    } catch (_) {}
  }
  return HHV9_normalizeAssessment_(value);
}

function HHV9_dateValue_(row) {
  return HHV9_pick_(row, [
    'serverTs', 'timestamp', 'serverTimestamp', 'clientTs', 'submittedAt',
    'finishedAt', 'date', 'เวลา', 'วันที่'
  ]);
}

function HHV9_latest_(rows) {
  if (!rows || !rows.length) return null;
  return rows.slice().sort(function(a, b) {
    return dateMs_(HHV9_dateValue_(b)) - dateMs_(HHV9_dateValue_(a));
  })[0] || rows[rows.length - 1];
}

function HHV9_buildStudentAuthority_(ss, sid) {
  var studentId = cleanStudentId_(sid);
  if (!studentId) {
    return {
      ok: false,
      error: 'missing_studentId',
      authority: 'google_sheet',
      bridgeVersion: HH_AUTHORITY_COMPAT_R34
    };
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
    bridgeVersion: HH_AUTHORITY_COMPAT_R34,
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
    authoritativeState: authority && (authority.authoritativeState || authority),
    bridgeVersion: HH_AUTHORITY_COMPAT_R34
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
    bridgeVersion: HH_AUTHORITY_COMPAT_R34
  };
}

function HH_R34_testV10Dependencies(studentId) {
  var sid = cleanStudentId_(studentId || '990023');
  var required = {
    HHV9_key_: typeof HHV9_key_ === 'function',
    HHV9_pick_: typeof HHV9_pick_ === 'function',
    HHV9_normalizeAssessment_: typeof HHV9_normalizeAssessment_ === 'function',
    HHV9_sheetRows_: typeof HHV9_sheetRows_ === 'function',
    HHV9_studentIdFromRow_: typeof HHV9_studentIdFromRow_ === 'function',
    HHV9_rowsForStudent_: typeof HHV9_rowsForStudent_ === 'function',
    HHV9_assessmentType_: typeof HHV9_assessmentType_ === 'function',
    HHV9_dateValue_: typeof HHV9_dateValue_ === 'function',
    HHV9_latest_: typeof HHV9_latest_ === 'function',
    HHV9_buildStudentAuthority_: typeof HHV9_buildStudentAuthority_ === 'function',
    HHV10_getAssignment_: typeof HHV10_getAssignment_ === 'function'
  };
  var missing = Object.keys(required).filter(function(name) { return required[name] !== true; });
  if (missing.length) throw new Error('missing_v10_dependencies: ' + missing.join(', '));

  var ss = getHHSpreadsheet_();
  var authority = HHV9_buildStudentAuthority_(ss, sid);
  var assignment = HHV10_getAssignment_(ss, sid);
  return {
    ok: authority && authority.ok !== false,
    studentId: sid,
    bridgeVersion: HH_AUTHORITY_COMPAT_R34,
    dependencies: required,
    missing: missing,
    authorityFound: authority && authority.found,
    assignmentFound: !!assignment,
    assignment: assignment,
    progress: authority && authority.progress
  };
}

function HH_R33_testAuthorityBridge(studentId) {
  return HH_R34_testV10Dependencies(studentId);
}
