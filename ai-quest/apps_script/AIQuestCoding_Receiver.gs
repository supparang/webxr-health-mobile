/**
 * CSAI2102 AI Quest Coding Receiver v2.1
 * Server-side evidence validation + official coding status lookup.
 * Requires AIQ3 Core and AIQuestCoding_Config.gs.
 * Does NOT declare doGet/doPost.
 */
var AIQCODING = AIQCODING || {};

AIQCODING.VERSION = '20260720-AIQ-CODING-RECEIVER-V2.1.0';

AIQCODING.text_ = function(v) {
  return String(v == null ? '' : v).trim();
};

AIQCODING.norm_ = function(v) {
  return AIQCODING.text_(v).toLowerCase().replace(/\s+/g, '');
};

AIQCODING.validateEvidence_ = function(sessionId, payload) {
  var output = AIQCODING.norm_(payload.output);
  var modified = AIQCODING.text_(payload.modifiedCode).toLowerCase();
  var challenge = AIQCODING.text_(payload.challengeCode).toLowerCase();
  var prediction = AIQCODING.norm_(payload.predictionAnswer);
  var expected = '';
  var modifyPassed = false;
  var challengePassed = false;

  if (sessionId === 'S1') {
    expected = AIQCODING.norm_('High temperature alert');
    modifyPassed = modified.indexOf('38.5') >= 0 && modified.indexOf('38') >= 0 && modified.indexOf('39') >= 0;
    challengePassed = challenge.indexOf('if') >= 0 && challenge.indexOf('elif') >= 0 && challenge.indexOf('else') >= 0 && challenge.indexOf('low') >= 0 && challenge.indexOf('normal') >= 0 && challenge.indexOf('high') >= 0;
  } else if (sessionId === 'S2') {
    expected = AIQCODING.norm_('clean');
    modifyPassed = modified.indexOf('obstacle') >= 0 && modified.indexOf('turn') >= 0;
    challengePassed = challenge.indexOf('battery_low') >= 0 && challenge.indexOf('goal_found') >= 0 && challenge.indexOf('return') >= 0;
  } else if (sessionId === 'S3') {
    expected = AIQCODING.norm_("['A', 'B', 'C', 'D', 'E']");
    modifyPassed = modified.indexOf("'f'") >= 0 && modified.indexOf("'d'") >= 0;
    challengePassed = challenge.indexOf('goal') >= 0 && challenge.indexOf('path') >= 0 && (challenge.indexOf('break') >= 0 || challenge.indexOf('return') >= 0);
  } else if (sessionId === 'B1') {
    expected = AIQCODING.norm_('search_new_route');
    modifyPassed = (modified.match(/percept/g) || []).length >= 3 && (modified.match(/return/g) || []).length >= 3;
    challengePassed = challenge.indexOf('deque') >= 0 && challenge.indexOf('blocked') >= 0 && (challenge.indexOf('path') >= 0 || challenge.indexOf('route') >= 0);
  }

  var outputPassed = expected && output.indexOf(expected) >= 0;
  var predictionCorrect = expected && prediction === expected;

  return {
    predictionCorrect: !!predictionCorrect,
    outputPassed: !!outputPassed,
    modifyPassed: !!modifyPassed,
    challengePassed: !!challengePassed,
    runScore: outputPassed ? 30 : 0,
    modifyScore: modifyPassed ? 50 : 0,
    challengeScore: challengePassed ? 20 : 0
  };
};

AIQCODING.submit_ = function(payload) {
  payload = payload || {};
  var sessionId = AIQCODING.text_(payload.sessionId).toUpperCase();

  if (!AIQCODING.allowedLab_(sessionId)) {
    return {ok:false, code:'LAB_NOT_AVAILABLE', sessionId:sessionId};
  }

  if (typeof AIQ3 === 'undefined' || typeof AIQ3.handle !== 'function') {
    return {ok:false, code:'AIQ3_CORE_MISSING'};
  }

  var evidence = AIQCODING.validateEvidence_(sessionId, payload);

  if (!evidence.outputPassed) {
    return {ok:false, code:'OUTPUT_EVIDENCE_FAILED', evidence:evidence};
  }

  if (!evidence.modifyPassed) {
    return {ok:false, code:'MODIFY_EVIDENCE_FAILED', evidence:evidence};
  }

  var coreResult = AIQ3.handle({
    action: 'SUBMIT_CODING',
    studentId: payload.studentId,
    studentName: payload.studentName,
    section: payload.section,
    sessionId: sessionId,
    codingAttemptId: payload.codingAttemptId,
    predictionAnswer: payload.predictionAnswer || '',
    predictionCorrect: evidence.predictionCorrect,
    runScore: evidence.runScore,
    modifyScore: evidence.modifyScore,
    challengeScore: evidence.challengeScore,
    runCount: Number(payload.runCount || 0),
    errorCount: Number(payload.errorCount || 0),
    errorTypes: payload.errorTypes || [],
    output: AIQCODING.text_(payload.output).slice(0, 5000),
    usedTimeSec: Number(payload.usedTimeSec || 0)
  });

  if (coreResult && coreResult.ok) {
    coreResult.evidence = evidence;
    coreResult.serverValidated = true;
    coreResult.version = AIQCODING.VERSION;
  }
  return coreResult;
};

AIQCODING.getStatus_ = function(payload) {
  payload = payload || {};
  var studentId = AIQCODING.text_(payload.studentId);
  var section = AIQCODING.text_(payload.section);
  var sessionId = AIQCODING.text_(payload.sessionId).toUpperCase();

  if (!studentId || !section || !sessionId) {
    return {ok:false, code:'MISSING_STATUS_IDENTITY'};
  }
  if (!AIQCODING.allowedLab_(sessionId)) {
    return {ok:false, code:'LAB_NOT_AVAILABLE', sessionId:sessionId};
  }
  if (typeof AIQ3 === 'undefined' || typeof AIQ3.findRows_ !== 'function') {
    return {ok:false, code:'AIQ3_CORE_MISSING'};
  }

  var rows = AIQ3.findRows_(AIQ3.SHEETS.CODING_ATTEMPTS, function(r){
    return AIQCODING.text_(r.student_id) === studentId &&
      AIQCODING.text_(r.section) === section &&
      AIQCODING.text_(r.session_id).toUpperCase() === sessionId;
  });

  rows.sort(function(a,b){
    return Number(a.attempt_number || 0) - Number(b.attempt_number || 0);
  });

  var latest = rows.length ? rows[rows.length - 1] : null;
  var best = rows.reduce(function(acc, row){
    return !acc || Number(row.coding_score || 0) > Number(acc.coding_score || 0) ? row : acc;
  }, null);
  var bestScore = best ? Number(best.coding_score || 0) : 0;
  var latestScore = latest ? Number(latest.coding_score || 0) : 0;

  return {
    ok:true,
    studentId:studentId,
    section:section,
    sessionId:sessionId,
    found:rows.length > 0,
    completed:bestScore >= 60,
    latestScore:latestScore,
    bestScore:bestScore,
    attemptCount:rows.length,
    latestAttempt:latest ? Number(latest.attempt_number || 0) : 0,
    submittedAt:latest ? latest.submitted_at || '' : '',
    version:AIQCODING.VERSION
  };
};

AIQCODING.handle = function(payload) {
  var action = AIQCODING.text_((payload || {}).action).toUpperCase();

  if (action === 'SUBMIT_CODING_LAB') {
    return AIQCODING.submit_(payload);
  }

  if (action === 'GET_CODING_STATUS') {
    return AIQCODING.getStatus_(payload);
  }

  if (action === 'GET_LAB_CONFIG') {
    var sessionId = AIQCODING.text_(payload.sessionId).toUpperCase();
    if (!AIQCODING.allowedLab_(sessionId)) {
      return {ok:false, code:'LAB_NOT_AVAILABLE'};
    }
    return {
      ok:true,
      version:AIQCODING.VERSION,
      sessionId:sessionId,
      config:AIQCODING.LABS[sessionId]
    };
  }

  return {ok:false, code:'UNKNOWN_CODING_ACTION'};
};