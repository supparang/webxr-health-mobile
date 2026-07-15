/* CSAI2102 AI Quest — Fast Student Gate v4.4.5
   Replace the previous v4.4.4 module in the Sheet-bound Apps Script project.

   Required doGet route (before studentProgress):

   if (action === 'studentGate') {
     setupSheets();
     return jsonOutMaybe_(aqStudentGate_(p), callback);
   }

   v4.4.5 keeps Google Sheet as the sole official source of truth and fixes
   Boss rows whose explicit pass evidence is stored in extraJson/raw rather
   than only in the legacy top-level bossWin field.
*/

function gateNorm_(value) {
  return String(value == null ? '' : value).trim();
}

function gateBool_(value) {
  if (value === true || value === 1) return true;
  const s = gateNorm_(value).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' ||
    s === 'submitted' || s === 'completed' || s === 'passed' || s === 'mastered';
}

function gateNum_(value) {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function gateJson_(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (err) { return {}; }
}

function gateCanonical_(row) {
  return canonicalSessionId_(
    row && row.sessionId,
    row && row.missionId,
    row && row.missionTitle
  );
}

function gateReflectionState_(row) {
  row = row || {};
  const extra = gateJson_(row.extraJson || row.extra || {});
  const raw = gateJson_(extra.raw || row.raw || {});

  const directText = [row.reflection1, row.reflection2, row.reflection3]
    .every(function(v) { return gateNorm_(v).length >= 3; });
  const rawText = [raw.reflection1, raw.reflection2, raw.reflection3]
    .every(function(v) { return gateNorm_(v).length >= 3; });

  const directFlag =
    gateBool_(row.reflectionSubmitted) ||
    gateNorm_(row.reflectionStatus).toLowerCase() === 'submitted' ||
    gateNorm_(row.submitStatus).toLowerCase() === 'reflection-submitted';
  const extraFlag =
    gateBool_(extra.reflectionSubmitted) ||
    gateNorm_(extra.reflectionStatus).toLowerCase() === 'submitted' ||
    gateNorm_(extra.submitStatus).toLowerCase() === 'reflection-submitted';
  const rawFlag =
    gateBool_(raw.reflectionSubmitted) ||
    gateNorm_(raw.reflectionStatus).toLowerCase() === 'submitted' ||
    gateNorm_(raw.submitStatus).toLowerCase() === 'reflection-submitted';

  return {
    submitted: directFlag || extraFlag || rawFlag || directText || rawText,
    directText: directText,
    rawText: rawText,
    directFlag: directFlag,
    extraFlag: extraFlag,
    rawFlag: rawFlag
  };
}

function gatePassState_(sessionId, row) {
  row = row || {};
  const id = gateNorm_(sessionId).toLowerCase();
  const extra = gateJson_(row.extraJson || row.extra || {});
  const raw = gateJson_(extra.raw || row.raw || {});

  const statuses = [
    row.status, row.gateStatus, row.submitStatus,
    extra.status, extra.gateStatus, extra.submitStatus,
    raw.status, raw.gateStatus, raw.submitStatus
  ].map(function(v) { return gateNorm_(v).toLowerCase(); });

  const explicitPassed = [
    row.passed, row.mastered, row.bossWin,
    extra.passed, extra.mastered, extra.bossWin,
    raw.passed, raw.mastered, raw.bossWin
  ].some(gateBool_);

  const statusPassed = statuses.some(function(s) {
    return s === 'passed' || s === 'mastered' || s === 'completed' ||
      s === 'reflection-submitted' || s === 'passed-awaiting-reflection';
  });

  const score = Math.max(
    gateNum_(row.bestScore), gateNum_(row.score),
    gateNum_(extra.bestScore), gateNum_(extra.score),
    gateNum_(raw.bestScore), gateNum_(raw.score)
  );

  const bossWin = [row.bossWin, extra.bossWin, raw.bossWin].some(gateBool_);
  let passed = explicitPassed || statusPassed;

  if (/^b[1-3]$/.test(id)) {
    passed = passed || bossWin;
  } else if (id === 'b4') {
    passed = (passed || bossWin) && score >= 70;
  } else if (id === 'b5') {
    passed = (passed || bossWin) && score >= 75;
  } else if (!passed && typeof officialPassForSession_ === 'function') {
    passed = officialPassForSession_(id, row);
  }

  return {
    passed: !!passed,
    score: score,
    explicitPassed: explicitPassed,
    statusPassed: statusPassed,
    bossWin: bossWin,
    statuses: statuses.filter(function(s) { return !!s; })
  };
}

function rowsForStudentFast_(sheetName, studentId) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function(h) { return gateNorm_(h); });
  const studentIndex = headers.indexOf('studentId');
  if (studentIndex < 0) return [];

  const wanted = gateNorm_(studentId);
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    if (gateNorm_(values[r][studentIndex]) !== wanted) continue;
    const obj = {};
    headers.forEach(function(h, i) { if (h) obj[h] = values[r][i]; });
    rows.push(obj);
  }
  return rows;
}

function aqStudentGate_(params) {
  params = params || {};
  const startedAt = Date.now();
  const studentId = clean_(params.studentId || '');
  const sessionId = canonicalSessionId_(params.sessionId, params.missionId, '');
  const requestedSection = gateNorm_(params.section || SECTION_LOCK);

  if (!/^[A-Za-z0-9_-]{1,32}$/.test(studentId)) {
    return {ok:false, action:'studentGate', found:false, error:'Invalid studentId', version:APP_VERSION, gateModuleVersion:'v4.4.5', serverTs:bangkokIsoNow()};
  }
  if (!sessionId) {
    return {ok:false, action:'studentGate', found:false, error:'Invalid sessionId', studentId:studentId, version:APP_VERSION, gateModuleVersion:'v4.4.5', serverTs:bangkokIsoNow()};
  }

  let passed = false;
  let reflected = false;
  let score = 0;
  let stars = 0;
  let latestTs = '';
  let found = false;
  let matchedProgressRows = 0;
  let matchedAttemptRows = 0;
  const reflectionDiagnostics = [];
  const passDiagnostics = [];

  const sectionMatches = function(row) {
    const rowSection = gateNorm_(row && row.section);
    return rowSection === gateNorm_(SECTION_LOCK) || rowSection === requestedSection;
  };

  const progressRows = rowsForStudentFast_(SHEETS.progress, studentId)
    .filter(function(row) { return sectionMatches(row) && gateCanonical_(row) === sessionId; });

  progressRows.forEach(function(row) {
    found = true;
    matchedProgressRows++;
    const pass = gatePassState_(sessionId, row);
    passed = passed || pass.passed;
    passDiagnostics.push({source:'progress', passed:pass.passed, explicitPassed:pass.explicitPassed, statusPassed:pass.statusPassed, bossWin:pass.bossWin, score:pass.score, statuses:pass.statuses});

    const state = gateReflectionState_(row);
    reflected = reflected || gateNorm_(row.status).toLowerCase() === 'completed' || state.submitted;
    if (state.submitted) reflectionDiagnostics.push({source:'progress', directFlag:state.directFlag, extraFlag:state.extraFlag, rawFlag:state.rawFlag, directText:state.directText, rawText:state.rawText});

    score = Math.max(score, pass.score, gateNum_(row.bestScore), gateNum_(row.score));
    stars = Math.max(stars, gateNum_(row.stars));
    latestTs = String(row.updatedAt || row.serverTs || latestTs || '');
  });

  const attemptRows = rowsForStudentFast_(SHEETS.attempts, studentId)
    .filter(function(row) { return sectionMatches(row) && gateCanonical_(row) === sessionId; });

  attemptRows.forEach(function(row) {
    found = true;
    matchedAttemptRows++;
    const pass = gatePassState_(sessionId, row);
    passed = passed || pass.passed;
    passDiagnostics.push({source:'attempt', attemptId:gateNorm_(row.attemptId), passed:pass.passed, explicitPassed:pass.explicitPassed, statusPassed:pass.statusPassed, bossWin:pass.bossWin, score:pass.score, statuses:pass.statuses});

    const state = gateReflectionState_(row);
    reflected = reflected || state.submitted || (typeof reflectionSubmitted_ === 'function' && reflectionSubmitted_(row));
    if (state.submitted) reflectionDiagnostics.push({source:'attempt', attemptId:gateNorm_(row.attemptId), directFlag:state.directFlag, extraFlag:state.extraFlag, rawFlag:state.rawFlag, directText:state.directText, rawText:state.rawText});

    score = Math.max(score, pass.score, gateNum_(row.score));
    stars = Math.max(stars, gateNum_(row.stars));
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
    matchedAttemptRows:matchedAttemptRows,
    matchedProgressRows:matchedProgressRows,
    submittedAt:latestTs,
    reflectionDiagnostics:reflectionDiagnostics.slice(-3),
    passDiagnostics:passDiagnostics.slice(-5),
    elapsedMs:Date.now() - startedAt,
    version:APP_VERSION,
    gateModuleVersion:'v4.4.5',
    serverTs:bangkokIsoNow()
  };
}
