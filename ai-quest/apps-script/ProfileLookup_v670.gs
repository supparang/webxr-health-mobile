/**
 * CSAI2102 AI Quest — Sheet-first Profile Lookup v6.7.0
 *
 * Add this file to the SAME Apps Script project as Code.gs.
 * Then add the small doGet route in README_PROFILE_LOOKUP_DEPLOY_v670.txt.
 *
 * Security model:
 * - exact studentId only; no name search, no list endpoint, no wildcard
 * - Section is forced to 101
 * - response exposes only studentId, studentName, section, updatedAt, lastSeenAt
 */
function aqProfileLookup_(params) {
  params = params || {};
  const studentId = clean_(params.studentId || '');
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(studentId)) {
    return {ok:false, action:'profileLookup', found:false, error:'Invalid studentId', version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  const profile = aqFindProfileById_(studentId);
  if (!profile) {
    return {ok:true, action:'profileLookup', found:false, studentId:studentId, section:SECTION_LOCK, version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  return {
    ok:true,
    action:'profileLookup',
    found:true,
    profile:profile,
    version:APP_VERSION,
    serverTs:bangkokIsoNow()
  };
}

function aqFindProfileById_(studentId) {
  const fromProfile = aqFindLatestStudentRow_(SHEETS.profiles, HEADERS.students_profile, studentId, 'students_profile');
  if (fromProfile) return fromProfile;

  // Supports learners who have old attempts but no explicit profile row yet.
  return aqFindLatestStudentRow_(SHEETS.attempts, HEADERS.session_attempts, studentId, 'attempt_fallback');
}

function aqFindLatestStudentRow_(sheetName, headers, studentId, source) {
  const sh = getSheet_(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return null;

  const idIndex = headers.indexOf('studentId');
  const nameIndex = headers.indexOf('studentName');
  const sectionIndex = headers.indexOf('section');
  const updatedIndex = headers.indexOf('updatedAt');
  const lastSeenIndex = headers.indexOf('lastSeenAt');
  const serverIndex = headers.indexOf('serverTs');

  for (let i = values.length - 1; i >= 1; i--) {
    const row = values[i];
    if (String(row[idIndex] || '').trim() !== studentId) continue;
    if (String(row[sectionIndex] || '') !== SECTION_LOCK) continue;

    const studentName = clean_(row[nameIndex] || '');
    if (!studentName) continue;

    return {
      studentId:studentId,
      studentName:studentName,
      section:SECTION_LOCK,
      updatedAt:clean_(updatedIndex >= 0 ? row[updatedIndex] : row[serverIndex]),
      lastSeenAt:clean_(lastSeenIndex >= 0 ? row[lastSeenIndex] : row[serverIndex]),
      source:source
    };
  }
  return null;
}