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


/**
 * Second-stage QA: find why BOTH AIQCODING and AIQFLOW returned found=false.
 * Read-only. No student IDs, names, answers, or grade changes are logged.
 * Exact match requires studentId + section + sessionId in a Coding-evidence tab.
 * Examines only the relevant identity columns, not submissions/answers.
 */
function TEST_AIQ_S11_CODING_EVIDENCE_LOCATOR_READONLY() {
  var props = PropertiesService.getScriptProperties();
  var id = String(props.getProperty('AIQ_QA_STUDENT_ID') || '').trim();
  var section = String(props.getProperty('AIQ_QA_SECTION') || '101').trim();
  var session = String(props.getProperty('AIQ_QA_SESSION') || 'S11').trim();
  var report = {
    audit:'AIQ_S11_CODING_EVIDENCE_LOCATOR_V2',
    mode:'READ_ONLY_NO_WRITE',
    studentConfigured:!!id,
    section:section,
    sessionId:session,
    sheets:[],
    overall:{codingSheetCount:0,codingRowsScanned:0,
      idMatches:0,sessionMatches:0,idAndSessionMatches:0,
      exactIdentityMatches:0,wrongSectionMatches:0},
    result:'NOT_CHECKED'
  };
  if (!id || typeof AIQFLOW==='undefined' || typeof AIQFLOW.findProfile_!=='function') {
    report.result = 'SET_SCRIPT_PROPERTY_OR_FLOW_MISSING';
    Logger.log(JSON.stringify(report));
    return report;
  }
  if (!AIQFLOW.findProfile_(id,section)) {
    report.result='ROSTER_NOT_AUTHORIZED';
    Logger.log(JSON.stringify(report));
    return report;
  }
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    report.result='NO_ACTIVE_SPREADSHEET';
    Logger.log(JSON.stringify(report));
    return report;
  }
  // Suffix is a non-authoritative hint to recognize an unintended Sheet mount.
  report.spreadsheetIdSuffix=String(ss.getId()).slice(-6);
  function headerIndex(headers,aliases) {
    return AIQFLOW.headerIndex_(headers,aliases);
  }
  var idNames=['student_id','studentId','student','student_no','studentNo','id','pid'];
  var secNames=['section','section_id','sectionId','class_section','classSection'];
  var stageNames=['session_id','sessionId','mission_id','missionId','session','mission'];
  var codingNames=['coding_score','codingScore','coding_completed','codingCompleted',
    'run_score','runScore','modify_score','modifyScore','challenge_score','challengeScore',
    'quiz_score','quizScore','completed_code','completedCode','modified_code','modifiedCode',
    'prediction_answer','predictionAnswer','validation_mode','validationMode'];
  var totalExact=0,totalIdStage=0;
  ss.getSheets().forEach(function(sh) {
    var lastRow=sh.getLastRow(),lastColumn=sh.getLastColumn();
    if (lastColumn<1) return;
    var headers=sh.getRange(1,1,1,lastColumn).getDisplayValues()[0];
    var idCol=headerIndex(headers,idNames),sessionCol=headerIndex(headers,stageNames);
    var secCol=headerIndex(headers,secNames);
    var codingCol=headerIndex(headers,codingNames);
    if (!/coding/i.test(sh.getName()) && codingCol<0) return;
    report.overall.codingSheetCount++;
    var info={sheet:sh.getName(),rowCount:Math.max(0,lastRow-1),
      idColumnFound:idCol>=0,sessionColumnFound:sessionCol>=0,
      sectionColumnFound:secCol>=0,codingEvidenceColumnFound:codingCol>=0,
      idMatches:0,sessionMatches:0,idAndSessionMatches:0,
      exactIdentityMatches:0,wrongSectionMatches:0,exactRowNumbers:[]};
    report.overall.codingRowsScanned+=info.rowCount;
    if (lastRow>=2 && idCol>=0 && sessionCol>=0) {
      var n=lastRow-1;
      var ids=sh.getRange(2,idCol+1,n,1).getDisplayValues();
      var sessions=sh.getRange(2,sessionCol+1,n,1).getDisplayValues();
      var sections=secCol>=0?sh.getRange(2,secCol+1,n,1).getDisplayValues():null;
      for (var r=0;r<n;r++) {
        var sameId=AIQFLOW.idKey_(ids[r][0])===AIQFLOW.idKey_(id);
        var sameStage=AIQFLOW.sessionKey_(sessions[r][0])===AIQFLOW.sessionKey_(session);
        var rowSection=(sections && sections[r][0]) || '101';
        var sameSection=AIQFLOW.sectionKey_(rowSection)===AIQFLOW.sectionKey_(section);
        if (sameId) info.idMatches++;
        if (sameStage) info.sessionMatches++;
        if (sameId && sameStage) {
          info.idAndSessionMatches++;
          if (sameSection) {
            info.exactIdentityMatches++;
            if(info.exactRowNumbers.length<10)info.exactRowNumbers.push(r+2);
          } else info.wrongSectionMatches++;
        }
      }
    }
    ['idMatches','sessionMatches','idAndSessionMatches',
     'exactIdentityMatches','wrongSectionMatches'].forEach(function(key){
       report.overall[key]+=info[key];
    });
    totalExact+=info.exactIdentityMatches;
    totalIdStage+=info.idAndSessionMatches;
    report.sheets.push(info);
  });
  report.result=totalExact>0?'MATCHING_ROW_EXISTS_CHECK_CODING_SCORE_AND_SOURCE':
    totalIdStage>0?'ID_AND_SESSION_FOUND_BUT_SECTION_MISMATCH':
    report.overall.idMatches>0?'STUDENT_CODING_ROWS_EXIST_BUT_NOT_S11':
    report.overall.sessionMatches>0?'S11_ROWS_EXIST_BUT_NO_MATCHING_STUDENT_ID':
    report.overall.codingSheetCount>0?'NO_MATCHING_CODING_ROWS_FOUND_IN_ACTIVE_SHEET':
      'NO_CODING_EVIDENCE_TABS_IN_ACTIVE_SHEET';
  Logger.log(JSON.stringify(report));
  return report;
}
