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


/**
 * Third-stage diagnostic: the previous locator proved no exact S11 Coding row.
 * Show WHICH stages this student's existing Coding rows belong to, without
 * logging names, IDs, answer text, or other students' row contents.
 * The name check is a diagnostic hint ONLY and never authorizes any unlock.
 * Safe to run from the Apps Script Editor, no deployment needed.
 */
function TEST_AIQ_S11_CODING_STAGE_DISTRIBUTION_READONLY() {
  var props=PropertiesService.getScriptProperties();
  var sid=String(props.getProperty('AIQ_QA_STUDENT_ID')||'').trim();
  var section=String(props.getProperty('AIQ_QA_SECTION')||'101').trim();
  var stage=String(props.getProperty('AIQ_QA_SESSION')||'S11').trim();
  var report={audit:'AIQ_S11_CODING_STAGE_DISTRIBUTION_V3',
    mode:'READ_ONLY_NO_WRITE',studentConfigured:!!sid,section:section,
    targetSession:stage,source:'ACTIVE_SPREADSHEET_EDITOR',
    tables:[],exactCodingRows:0,nameOnlyCandidatesAtTarget:0,
    conclusion:'NOT_RUN'};
  if(!sid||typeof AIQFLOW==='undefined'||typeof AIQFLOW.findProfile_!=='function') {
    report.conclusion='IDENTITY_OR_FLOW_MISSING';
    Logger.log(JSON.stringify(report));return report;
  }
  var profile=AIQFLOW.findProfile_(sid,section);
  if(!profile) {
    report.conclusion='ROSTER_NOT_AUTHORIZED';
    Logger.log(JSON.stringify(report));return report;
  }
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss) {report.conclusion='SPREADSHEET_MISSING';Logger.log(JSON.stringify(report));return report;}
  report.spreadsheetIdSuffix=String(ss.getId()).slice(-6);
  var idCols=['student_id','studentId','student','student_no','studentNo','id','pid'];
  var secCols=['section','section_id','sectionId','class_section','classSection'];
  var stageCols=['session_id','sessionId','mission_id','missionId','session','mission'];
  var nameCols=['student_name','studentName','name','full_name','nickname'];
  var evidenceCols=['coding_score','codingScore','coding_completed','codingCompleted',
    'run_score','runScore','quiz_score','quizScore','completed_code','completedCode',
    'modified_code','modifiedCode','prediction_answer','predictionAnswer',
    'validation_mode','validationMode','modify_score','modifyScore'];
  var timestampCols=['submitted_at','submittedAt','serverTs','created_at','createdAt'];
  function index(h,n){return AIQFLOW.headerIndex_(h,n);}
  function text(v){return String(v==null?'':v).trim();}
  function canonicalStage(raw) {
    return AIQFLOW.sessionKey_(raw)||'UNRECOGNIZED_STAGE';
  }
  function nameKey(v){return text(v).toLowerCase().replace(/[\s.\-_,]+/g,'');}
  var targetName=nameKey(profile.studentName);
  var targetStage=canonicalStage(stage);
  var hasExact=false,hasRawUnknown=false,otherNameCandidate=false;
  ss.getSheets().forEach(function(sh) {
    if(sh.getLastRow()<2||sh.getLastColumn()<1)return;
    var headers=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
    var idCol=index(headers,idCols),stageCol=index(headers,stageCols);
    var codingCol=index(headers,evidenceCols);
    var isCoding=/coding/i.test(sh.getName())||codingCol>=0;
    if(!isCoding||idCol<0||stageCol<0)return;
    var secCol=index(headers,secCols),nameCol=index(headers,nameCols);
    var tsCol=index(headers,timestampCols);
    var n=sh.getLastRow()-1;
    function column(col){return col>=0?sh.getRange(2,col+1,n,1).getDisplayValues().map(function(x){return x[0];}):null;}
    var ids=column(idCol),stages=column(stageCol),sections=column(secCol);
    var names=targetName?column(nameCol):null;
    var timestamps=column(tsCol);
    var info={sheet:sh.getName(),sourceType:/coding/i.test(sh.getName())?'CODING_TAB':'SUMMARY_OR_OTHER_TAB',
      totalRows:n,matchesStudentId:0,exactStudentAndStage:0,
      studentOtherSection:0,studentStageCounts:{},
      recentStudentRows:[],sameNameTargetButDifferentId:0,
      unrecognizedSessionCount:0};
    for(var i=0;i<n;i++){
      var isId=AIQFLOW.idKey_(ids[i])===AIQFLOW.idKey_(sid);
      var isStage=canonicalStage(stages[i])===targetStage;
      var isSection=AIQFLOW.sectionKey_((sections&&sections[i])||'101')===
                    AIQFLOW.sectionKey_(section);
      if(isId){
        info.matchesStudentId++;
        var sessionName=canonicalStage(stages[i]);
        info.studentStageCounts[sessionName]=(info.studentStageCounts[sessionName]||0)+1;
        if(sessionName==='UNRECOGNIZED_STAGE') {
          info.unrecognizedSessionCount++;hasRawUnknown=true;
        }
        if(!isSection)info.studentOtherSection++;
        if(isStage&&isSection) {
          info.exactStudentAndStage++;report.exactCodingRows++;hasExact=true;
        }
        // Last 8 rows with stage, sheet row index and optional timestamp only.
        info.recentStudentRows.push({row:i+2,stage:sessionName,
          sectionMatches:isSection,submittedAt:timestamps?text(timestamps[i]).slice(0,32):''});
        if(info.recentStudentRows.length>8)info.recentStudentRows.shift();
      }
      if(!isId&&isStage&&isSection&&targetName&&names&&
         nameKey(names[i])===targetName) {
        info.sameNameTargetButDifferentId++;
        report.nameOnlyCandidatesAtTarget++;
        otherNameCandidate=true;
      }
    }
    // Output sorted by course order, never by private identifiers.
    var order=['S1','S2','S3','B1','S4','S5','S6','B2',
      'S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5','UNRECOGNIZED_STAGE'];
    var sorted={};
    order.forEach(function(s){if(info.studentStageCounts[s])sorted[s]=info.studentStageCounts[s];});
    info.studentStageCounts=sorted;
    report.tables.push(info);
  });
  report.conclusion=hasExact?'EXACT_STAGE_ROW_FOUND_CHECK_CODING_SCORE':
    otherNameCandidate?'S11_SAME_NAME_DIFFERENT_ID_CHECK_SUBMISSION_IDENTITY':
    hasRawUnknown?'UNRECOGNIZED_SESSION_LABEL_CHECK_STAGE_MAPPING':
    'NO_S11_ROW_FOR_STUDENT_CHECK_SUBMIT_CONFIRMATION';
  Logger.log(JSON.stringify(report));return report;
}
