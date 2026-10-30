/**
 * CSAI2601 UX Quest • W15 Mission evidence audit — READ ONLY.
 * Install in the existing UX Quest Apps Script project (NOT AI Quest).
 * Set Script Properties UXQ_QA_STUDENT_ID and UXQ_QA_SECTION privately.
 * Optional: UXQ_QA_COURSE_ID (default UXQ-ACT1-2026).
 *
 * NEVER creates mission_completed, grants completion, writes Sheet, or
 * outputs identifiable student information into the public repository.
 */
function TEST_UXQ_W15_MISSION_READONLY_V1() {
  var props=PropertiesService.getScriptProperties();
  var studentId=String(props.getProperty('UXQ_QA_STUDENT_ID')||'').trim();
  var section=String(props.getProperty('UXQ_QA_SECTION')||'').trim();
  var courseId=String(props.getProperty('UXQ_QA_COURSE_ID')||'UXQ-ACT1-2026').trim();
  if(!studentId||!section)return {
    test:'UXQ_W15_MISSION_READONLY_V1',mode:'NO_WRITE',ok:false,
    code:'SET_PRIVATE_SCRIPT_PROPERTIES',
    required:['UXQ_QA_STUDENT_ID','UXQ_QA_SECTION'],optional:['UXQ_QA_COURSE_ID']
  };
  var sheet=typeof UXQ_restoreAttemptsSheet_==='function'
    ? UXQ_restoreAttemptsSheet_()
    : (function(){
        var ss=SpreadsheetApp.getActiveSpreadsheet();
        if(!ss)throw Error('SHEET_NOT_FOUND');
        return ss.getSheetByName('UXQuest_Attempts');
      })();
  if(!sheet)throw Error('UXQUEST_ATTEMPTS_NOT_FOUND');
  var values=sheet.getDataRange().getDisplayValues();
  var report=UXQ_W15_analyzeReadOnly_(values,studentId,section,courseId);
  report.sheet=sheet.getName();
  Logger.log(JSON.stringify(report));
  return report;
}

function UXQ_W15_analyzeReadOnly_(values,studentId,section,courseId) {
  var ORDER=['w1','w2','w3','b1','w4','w5','w6','w7','b2',
    'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  var key=function(s){return String(s==null?'':s).trim().toLowerCase().replace(/[^a-z0-9]/g,'');};
  var clean=function(s){return String(s==null?'':s).trim();};
  var bool=function(s){return /^(true|1|yes|passed|pass)$/i.test(clean(s));};
  var lines=Array.isArray(values)?values:[];
  var headers=(lines[0]||[]).map(key),col={};
  headers.forEach(function(h,i){if(h&&col[h]===undefined)col[h]=i;});
  var required=['studentid','section','missionid','eventtype'];
  var missing=required.filter(function(h){return col[h]===undefined;});
  if(missing.length)return {test:'UXQ_W15_MISSION_READONLY_V1',mode:'NO_WRITE',
    ok:false,code:'MISSING_OFFICIAL_COLUMNS',missingColumns:missing};
  var get=function(row,h){return col[h]===undefined?'':clean(row[col[h]]);};
  var counts={sameStudent:0,correctSection:0,correctCourse:0,
    wrongSection:0,wrongCourse:0,w15OtherEvents:0,w15MissionAttempts:0,
    w15PassedRows:0,w15FailedRows:0,b4PassedRows:0};
  var events={},passed={},w15Rows=[],lastRow=0;
  for(var i=1;i<lines.length;i++){
    var row=lines[i];
    if(get(row,'studentid')!==studentId)continue;
    counts.sameStudent++;
    if(get(row,'section')!==section){counts.wrongSection++;continue;}
    counts.correctSection++;
    var c=get(row,'courseid');
    if(c&&c!==courseId){counts.wrongCourse++;continue;}
    counts.correctCourse++;
    var id=get(row,'missionid').toLowerCase();
    var type=get(row,'eventtype').toLowerCase();
    if(id==='w15'&&type!=='mission_completed')counts.w15OtherEvents++;
    if(type!=='mission_completed'||ORDER.indexOf(id)<0)continue;
    var stars=Number(get(row,'stars'))||0;
    var valid=bool(get(row,'passed'))||stars>=2;
    events[id]=(events[id]||0)+1;
    if(valid)passed[id]=true;
    if(id==='w15'){
      counts.w15MissionAttempts++;
      counts[valid?'w15PassedRows':'w15FailedRows']++;
      w15Rows.push({rowNumber:i+1,passed:valid,stars:stars,hasEventId:!!get(row,'eventid')});
      lastRow=i+1;
    }
    if(id==='b4'&&valid)counts.b4PassedRows++;
  }
  var completed=0;
  while(completed<ORDER.length&&passed[ORDER[completed]])completed++;
  var firstMissing=ORDER[completed]||'';
  var issue=counts.w15PassedRows>0
    ? (completed===19?'W15_CONFIRMED_CANONICAL':'W15_PASS_EXISTS_BUT_PREVIOUS_MISSION_GAP')
    : counts.w15MissionAttempts>0?'W15_MISSION_ROWS_PRESENT_BUT_NOT_PASSED'
    : counts.w15OtherEvents>0?'ONLY_STUDIO_OR_OTHER_W15_EVENTS'
    : counts.wrongSection>0?'NO_W15_IN_TARGET_SECTION_CHECK_SECTION'
    : counts.wrongCourse>0?'NO_W15_WITH_CORRECT_COURSE_CHECK_COURSE_ID'
    : 'NO_W15_MISSION_EVENT_FOUND';
  return {test:'UXQ_W15_MISSION_READONLY_V1',mode:'NO_WRITE',ok:true,
    identityScope:'EXACT_STUDENT_SECTION_COURSE',canonicalOrderLength:ORDER.length,
    counts:counts,completedNodes:completed,firstMissingMission:firstMissing,
    w15InCanonical:completed===19,b4Passed:Boolean(passed.b4),
    w15Rows:w15Rows.slice(-8),lastW15Row:lastRow,issue:issue,
    nextAction:completed===19?'VERIFY_MISSION_CONTROL_SNAPSHOT':
      counts.w15PassedRows>0?'AUDIT_EARLIEST_MISSING_MISSION':
      counts.w15MissionAttempts>0?'REVIEW_W15_ATTEMPT_RESULT':
      'VERIFY_W15_GAME_RESULT_AND_POST_TRANSPORT'};
}

/** Synthetic-only QA. No Apps Script services or student records accessed. */
function TEST_UXQ_W15_MISSION_AUDIT_FIXTURES_READONLY_V1() {
  var header=['studentId','section','courseId','missionId','eventType','passed','stars','eventId'];
  var order=['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  var row=function(id,type,passed){return ['SYNTHETIC','201','UXQ-ACT1-2026',id,type,passed?'TRUE':'FALSE',passed?'3':'1','qa_'+id];};
  var full=[header].concat(order.map(function(id){return row(id,'mission_completed',true);}));
  var missing=full.filter(function(r){return r[3]!=='w15';});
  var failed=[header].concat(order.map(function(id){return row(id,'mission_completed',id!=='w15');}));
  var outOfOrder=[header].concat(order.filter(function(id){return id!=='w12';}).map(function(id){return row(id,'mission_completed',true);}));
  var a=UXQ_W15_analyzeReadOnly_(full,'SYNTHETIC','201','UXQ-ACT1-2026');
  var b=UXQ_W15_analyzeReadOnly_(missing,'SYNTHETIC','201','UXQ-ACT1-2026');
  var c=UXQ_W15_analyzeReadOnly_(failed,'SYNTHETIC','201','UXQ-ACT1-2026');
  var d=UXQ_W15_analyzeReadOnly_(outOfOrder,'SYNTHETIC','201','UXQ-ACT1-2026');
  var ok=a.issue==='W15_CONFIRMED_CANONICAL'&&a.completedNodes===19&&
    b.issue==='NO_W15_MISSION_EVENT_FOUND'&&b.firstMissingMission==='w15'&&
    c.issue==='W15_MISSION_ROWS_PRESENT_BUT_NOT_PASSED'&&
    d.issue==='W15_PASS_EXISTS_BUT_PREVIOUS_MISSION_GAP'&&d.firstMissingMission==='w12';
  var result={test:'UXQ_W15_MISSION_AUDIT_FIXTURES_READONLY_V1',mode:'NO_WRITE',
    cases:4,passed:ok?4:0,result:ok?'PASS':'FAIL'};
  Logger.log(JSON.stringify(result));
  return result;
}
