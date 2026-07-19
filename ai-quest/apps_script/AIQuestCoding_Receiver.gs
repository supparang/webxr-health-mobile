
/**
 * Receives coding lab evidence and forwards it to AIQ3 Core.
 * Requires AIQuest Core v3.0 to already exist in the project.
 */
var AIQCODING = AIQCODING || {};

AIQCODING.submit_ = function(payload) {
  payload = payload || {};
  var sessionId = String(payload.sessionId || '').trim().toUpperCase();

  if (!AIQCODING.allowedLab_(sessionId)) {
    return {ok:false, code:'LAB_NOT_AVAILABLE', sessionId:sessionId};
  }

  if (typeof AIQ3 === 'undefined' || typeof AIQ3.handle !== 'function') {
    return {ok:false, code:'AIQ3_CORE_MISSING'};
  }

  var runScore = Math.max(0, Math.min(30, Number(payload.runScore || 0)));
  var modifyScore = Math.max(0, Math.min(50, Number(payload.modifyScore || 0)));
  var challengeScore = Math.max(0, Math.min(20, Number(payload.challengeScore || 0)));

  return AIQ3.handle({
    action: 'SUBMIT_CODING',
    studentId: payload.studentId,
    studentName: payload.studentName,
    section: payload.section,
    sessionId: sessionId,
    codingAttemptId: payload.codingAttemptId,
    predictionAnswer: payload.predictionAnswer || '',
    predictionCorrect: !!payload.predictionCorrect,
    runScore: runScore,
    modifyScore: modifyScore,
    challengeScore: challengeScore,
    runCount: Number(payload.runCount || 0),
    errorCount: Number(payload.errorCount || 0),
    errorTypes: payload.errorTypes || [],
    output: String(payload.output || '').slice(0, 5000),
    usedTimeSec: Number(payload.usedTimeSec || 0)
  });
};

AIQCODING.handle = function(payload) {
  var action = String((payload || {}).action || '').trim().toUpperCase();
  if (action === 'SUBMIT_CODING_LAB') {
    return AIQCODING.submit_(payload);
  }
  if (action === 'GET_LAB_CONFIG') {
    var sessionId = String(payload.sessionId || '').trim().toUpperCase();
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
