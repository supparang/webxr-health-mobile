/**
 * CSAI2102 • S11 Coding / Flow consistency audit (READ ONLY, NO SHEET WRITE)
 *
 * Install into the SAME Apps Script project that serves AI Quest.
 * Before running, set Script Property AIQ_QA_STUDENT_ID to the student ID
 * you need to verify. Optionally set AIQ_QA_SECTION=101,
 * AIQ_QA_SESSION=S11. Never commit student names or IDs to GitHub.
 *
 * Use the Apps Script editor > Run > TEST_AIQ_S11_CODING_FLOW_READONLY.
 * This reads status using the SAME module handlers used by the Web App.
 * It does not write rows, issue credits, grant unlocks or modify scores.
 *
 * Important: editor executions use SAVED DRAFT source, not necessarily
 * the currently deployed /exec version. Confirm /exec Flow version
 * separately from the student-facing diagnostic display.
 */
function TEST_AIQ_S11_CODING_FLOW_READONLY() {
  var version = 'AIQ_S11_CODING_FLOW_READONLY_V1';
  var props = PropertiesService.getScriptProperties();
  var studentId = String(props.getProperty('AIQ_QA_STUDENT_ID') || '').trim();
  var section = String(props.getProperty('AIQ_QA_SECTION') || '101').trim();
  var sessionId = String(props.getProperty('AIQ_QA_SESSION') || 'S11').trim().toUpperCase();
  var summary = {
    audit: version,
    mode: 'READ_ONLY_NO_WRITE',
    studentConfigured: !!studentId,
    section: section,
    sessionId: sessionId,
    editorFlowVersion: typeof AIQFLOW === 'undefined' ? 'MISSING' : AIQFLOW.VERSION,
    editorCodingVersion: typeof AIQCODING === 'undefined' ? 'MISSING' : AIQCODING.VERSION,
    editorCodingRepairVersion: typeof AIQCODING === 'undefined' ? 'MISSING' :
      String(AIQCODING.STATUS_REPAIR_VERSION || 'NOT_INSTALLED')
  };
  if (!studentId) {
    summary.ok = false;
    summary.code = 'SET_SCRIPT_PROPERTY_AIQ_QA_STUDENT_ID';
    Logger.log(JSON.stringify(summary));
    return summary;
  }
  if (typeof AIQFLOW === 'undefined' || typeof AIQFLOW.handle !== 'function' ||
      typeof AIQCODING === 'undefined' || typeof AIQCODING.handle !== 'function') {
    summary.ok = false;
    summary.code = 'FLOW_OR_CODING_HANDLER_MISSING';
    Logger.log(JSON.stringify(summary));
    return summary;
  }

  // Authorize identity first. Do not audit student attempts for an inactive
  // or non-student roster identity.
  var profile = AIQFLOW.findProfile_(studentId, section);
  if (!profile) {
    summary.ok = false;
    summary.code = 'ROSTER_NOT_AUTHORIZED';
    Logger.log(JSON.stringify(summary));
    return summary;
  }

  var common = {studentId: studentId, section: section, sessionId: sessionId};
  var flow = AIQFLOW.handle({
    module: 'AIQFLOW', action: 'GET_SESSION_STATUS',
    studentId: studentId, section: section, sessionId: sessionId
  });
  var coding = AIQCODING.handle({
    module: 'AIQCODING', action: 'GET_CODING_STATUS',
    studentId: studentId, section: section, sessionId: sessionId
  });
  function summaryStatus(status) {
    var safe = status || {};
    return {
      ok: safe.ok === true,
      code: String(safe.code || ''),
      completed: safe.completed === true,
      found: safe.found === true,
      bestScore: Number(safe.bestScore || 0),
      attemptCount: Number(safe.attemptCount || 0),
      sourceSheets: Array.isArray(safe.sourceSheets) ? safe.sourceSheets : [],
      version: String(safe.version || '')
    };
  }
  summary.ok = flow && flow.ok === true && coding && coding.ok === true;
  summary.flow = summaryStatus(flow && flow.coding);
  summary.flow.ok = !!(flow && flow.ok === true);
  summary.flow.version = String((flow && flow.version) || '');
  summary.flow.missionCompleted = !!(flow && flow.mission && flow.mission.completed === true);
  summary.coding = summaryStatus(coding);
  summary.sameCompletion = summary.flow.completed === summary.coding.completed;
  summary.sameScore = summary.flow.bestScore === summary.coding.bestScore;
  summary.result = !summary.ok ? 'STATUS_READ_FAILED' :
    summary.sameCompletion ? 'COMPLETION_MATCHES' : 'CODING_FLOW_MISMATCH';
  summary.next = !summary.ok ? 'REVIEW_MODULE_RESPONSE' :
    summary.sameCompletion && !summary.sameScore ? 'REVIEW_SCORE_COMPONENTS' :
    summary.sameCompletion ? 'CHECK_REFLECTION_STATUS' :
    'CHECK_DEPLOYED_FLOW_VERSION_AND_CODING_SOURCE_SHEETS';
  // No student ID, name, answer or full coding payload is logged.
  Logger.log(JSON.stringify(summary));
  return summary;
}
