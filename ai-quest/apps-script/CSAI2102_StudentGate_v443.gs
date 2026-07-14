/* CSAI2102 AI Quest — Fast Student Gate v4.4.3
   Add this module to the v4.4.2 reflection-gated Apps Script project.
   Then add this route in doGet(e) before studentProgress:

   if (action === 'studentGate') {
     setupSheets();
     return jsonOutMaybe_(aqStudentGate_(p), callback);
   }
*/

function rowsForStudentFast_(sheetName, studentId) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  const studentIndex = headers.indexOf('studentId');
  if (studentIndex < 0) return [];

  const cells = sh
    .getRange(2, studentIndex + 1, lastRow - 1, 1)
    .createTextFinder(String(studentId))
    .matchEntireCell(true)
    .findAll();

  return cells.map(function(cell) {
    const values = sh.getRange(cell.getRow(), 1, 1, lastCol).getValues()[0];
    const obj = {};
    headers.forEach(function(h, i) { if (h) obj[h] = values[i]; });
    return obj;
  });
}

function aqStudentGate_(params) {
  params = params || {};

  const studentId = clean_(params.studentId || '');
  const sessionId = canonicalSessionId_(params.sessionId, params.missionId, '');

  if (!/^[A-Za-z0-9_-]{1,32}$/.test(studentId)) {
    return {ok:false, action:'studentGate', found:false, error:'Invalid studentId', version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  if (!sessionId) {
    return {ok:false, action:'studentGate', found:false, error:'Invalid sessionId', studentId:studentId, version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  let passed = false;
  let reflected = false;
  let score = 0;
  let stars = 0;
  let latestTs = '';
  let found = false;

  const progressRows = rowsForStudentFast_(SHEETS.progress, studentId)
    .filter(function(row) {
      return String(row.section || '') === SECTION_LOCK &&
        canonicalSessionId_(row.sessionId, row.missionId, '') === sessionId;
    });

  progressRows.forEach(function(row) {
    found = true;
    const extra = safeJsonObject_(row.extraJson || {});
    passed = passed || officialPassForSession_(sessionId, {
      status:row.status,
      bestScore:row.bestScore,
      bossWin:extra.bossWin,
      mastered:String(row.status || '').toLowerCase() === 'mastered'
    });
    reflected = reflected ||
      String(row.status || '').toLowerCase() === 'completed' ||
      bool_(extra.reflectionSubmitted) ||
      String(extra.reflectionStatus || '').toLowerCase() === 'submitted';
    score = Math.max(score, num_(row.bestScore));
    stars = Math.max(stars, num_(row.stars));
    latestTs = String(row.updatedAt || row.serverTs || latestTs || '');
  });

  const attemptRows = rowsForStudentFast_(SHEETS.attempts, studentId)
    .filter(function(row) {
      return String(row.section || '') === SECTION_LOCK &&
        canonicalSessionId_(row.sessionId, row.missionId, row.missionTitle) === sessionId;
    });

  attemptRows.forEach(function(row) {
    found = true;
    passed = passed || officialPassForSession_(sessionId, row);
    reflected = reflected || reflectionSubmitted_(row);
    score = Math.max(score, num_(row.score));
    stars = Math.max(stars, num_(row.stars));
    const ts = String(row.serverTs || row.clientTs || '');
    if (dateValue_(ts) >= dateValue_(latestTs)) latestTs = ts;
  });

  return {
    ok:true,
    action:'studentGate',
    found:found,
    studentId:studentId,
    section:SECTION_LOCK,
    sessionId:sessionId,
    passed:passed,
    reflectionSubmitted:reflected,
    reflectionStatus:reflected ? 'submitted' : 'missing',
    completed:passed && reflected,
    status:passed && reflected ? 'completed' : passed ? 'passed-awaiting-reflection' : found ? 'attempted' : 'not-found',
    score:score,
    stars:stars,
    attemptCount:attemptRows.length,
    submittedAt:latestTs,
    version:APP_VERSION,
    serverTs:bangkokIsoNow()
  };
}
