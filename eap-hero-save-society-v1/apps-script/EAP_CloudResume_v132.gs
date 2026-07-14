/* =========================================================
   EAP Hero Cloud Resume v133 — Sheet Authority + Boss Review
   - player_resume is the sole official source for progress/unlocks.
   - Reads direct columns and nested valueJson event payloads.
   - Returns only valid S1–S15 / B1–B5 records for studentId + section.
   - Boss Speaking is not passed while review is pending/revise/missing.
   - Uses TextFinder on the studentId column instead of scanning whole sheets.
========================================================= */
var EAP_CLOUD_RESUME_VERSION = 'v20260714-EAP-CLOUD-RESUME-V133-SHEET-AUTHORITY-BOSS-REVIEW-TEXTFINDER';
var EAP_CLOUD_RESUME_ROUTE_ORDER = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'
];
var EAP_CLOUD_RESUME_SHEETS = [
  'eap-v132-events','attempts','evidence','summary','events',
  'EAP_Attempts','EAP_Evidence','EAP_Summary','eap-v132-quality-audit'
];
function eapPlayerResume_(p) {
  p = p || {};
  var studentId = eapCloudResumeText_(p.studentId || p.id || p.playerId || '');
  var studentName = eapCloudResumeText_(p.studentName || p.name || '');
  var section = eapCloudResumeText_(p.section || '122') || '122';
  if (!studentId) return {ok:false,service:'eap-cloud-resume',version:EAP_CLOUD_RESUME_VERSION,error:'missing_studentId'};
  var ss = eapCloudResumeSpreadsheet_();
  var all = [], scanned = [], ignored = 0;
  EAP_CLOUD_RESUME_SHEETS.forEach(function(sheetName){
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    scanned.push(sheetName);
    var result = eapCloudResumeRowsFromSheet_(sheet,sheetName,studentId,section);
    all = all.concat(result.rows);
    ignored += result.ignored;
  });
  var records = eapCloudResumeDeduplicate_(all);
  return {
    ok:true,service:'eap-cloud-resume',version:EAP_CLOUD_RESUME_VERSION,
    authorityMode:'sheet-only',studentId:studentId,studentName:studentName,section:section,
    recordCount:records.length,records:records,scannedSheets:scanned,
    ignoredInvalidRouteRows:ignored,validRouteOrder:EAP_CLOUD_RESUME_ROUTE_ORDER.slice(),
    latestActivity:records.length ? records[records.length-1].updatedAt : '',
    generatedAt:new Date().toISOString(),
    serverRevision:Utilities.formatDate(new Date(),Session.getScriptTimeZone() || 'Asia/Bangkok',"yyyyMMdd'T'HHmmss")
  };
}
function eapCloudResumeRowsFromSheet_(sheet,sheetName,studentId,section){
  var lastRow=sheet.getLastRow(),lastCol=sheet.getLastColumn(),out=[],ignored=0;
  if(lastRow<2||lastCol<1)return{rows:out,ignored:ignored};
  var headers=sheet.getRange(1,1,1,lastCol).getValues()[0].map(function(v){return eapCloudResumeText_(v);});
  var studentColumn=-1;
  ['studentId','student_id','playerId','id'].some(function(name){studentColumn=headers.indexOf(name);return studentColumn>=0;});
  if(studentColumn<0)return{rows:out,ignored:ignored};
  var matches=sheet.getRange(2,studentColumn+1,lastRow-1,1).createTextFinder(studentId).matchEntireCell(true).findAll();
  matches.forEach(function(cell){
    var row=sheet.getRange(cell.getRow(),1,1,lastCol).getValues()[0];
    var direct=eapCloudResumeObject_(headers,row);
    var nested=eapCloudResumeParseJson_(direct.valueJson || direct.rawJson || direct.payloadJson || '');
    var obj=eapCloudResumeMerge_(nested,direct);
    var sid=eapCloudResumeText_(eapCloudResumePick_(obj,['studentId','student_id','playerId','id']));
    if(sid!==studentId)return;
    var sec=eapCloudResumeText_(eapCloudResumePick_(obj,['section','classGroup','class','group']));
    if(sec&&section&&sec!==section)return;
    if(!sec)obj.section=section;
    var record=eapCloudResumeNormalizeRecord_(obj,sheetName,studentId,section);
    if(record&&record.sessionId&&record.skill&&!record.legacyCompletion&&eapCloudResumeIsValidRoute_(record.sessionId))out.push(record);else ignored++;
  });
  return{rows:out,ignored:ignored};
}
function eapCloudResumeNormalizeRecord_(obj,sheetName,studentId,section){
  obj=obj||{};
  var routeId=eapCloudResumeRouteId_(eapCloudResumePick_(obj,['routeId','sessionId','session','missionId','stage']));
  var skill=eapCloudResumeSkill_(eapCloudResumePick_(obj,['skill','skillName','skillKey','focusSkill']));
  if(!routeId||!skill||!eapCloudResumeIsValidRoute_(routeId))return null;
  var score=eapCloudResumeNumber_(eapCloudResumePick_(obj,['bestScore','latestScore','score','teacherScore']),0);
  var accuracy=eapCloudResumeNumber_(eapCloudResumePick_(obj,['bestAccuracy','accuracy','accuracyPct','accPct']),'');
  var basePassed=eapCloudResumeBool_(eapCloudResumePick_(obj,['passed','pass','mastered','verifiedPassed']))||score>=60;
  var reviewRequired=eapCloudResumeBool_(obj.teacherReviewRequired)||(/^B[1-5]$/.test(routeId)&&skill.toLowerCase()==='speaking');
  var reviewStatus=eapCloudResumeText_(obj.teacherReviewStatus||obj.reviewStatus||'').toLowerCase();
  var reviewPass=true;
  if(reviewRequired){
    reviewPass=!!reviewStatus&&!/(pending|revise|revision|rework|needs[_ -]?work|not[_ -]?reviewed)/i.test(reviewStatus)&&/(reviewed|approved|accepted|pass|passed|complete|completed)/i.test(reviewStatus);
  }
  var passed=basePassed&&reviewPass;
  var legacy=eapCloudResumeBool_(eapCloudResumePick_(obj,['legacyCompletion','legacy','isLegacy']));
  var updatedAt=eapCloudResumeText_(eapCloudResumePick_(obj,['teacherReviewedAt','updatedAt','latestAt','receivedAt','completedAt','clientTimestamp','occurredAt','createdAt']))||new Date().toISOString();
  return {
    studentId:studentId,studentName:eapCloudResumeText_(obj.studentName||obj.name||''),section:section,
    routeId:routeId,sessionId:routeId,
    sessionTitle:eapCloudResumeText_(eapCloudResumePick_(obj,['routeTitle','sessionTitle','missionTitle'])),
    skill:skill,score:score,bestScore:score,latestScore:score,accuracy:accuracy,bestAccuracy:accuracy,
    passed:passed,updatedAt:updatedAt,latestAt:updatedAt,
    restoredFromSheet:true,cloudVerified:true,serverVerified:true,resumeSource:'server_'+sheetName,sourceSheet:sheetName,
    attemptId:eapCloudResumeText_(obj.attemptId||''),evidenceId:eapCloudResumeText_(obj.evidenceId||obj.eventId||''),
    teacherReviewRequired:reviewRequired,teacherReviewStatus:reviewStatus,legacyCompletion:legacy
  };
}
function eapCloudResumeDeduplicate_(rows){
  var best={};
  (rows||[]).forEach(function(row){
    var key=row.sessionId+'|'+eapCloudResumeSkill_(row.skill).toLowerCase();
    var current=best[key];
    if(!current){best[key]=row;return;}
    if(row.passed&&!current.passed){best[key]=row;return;}
    if(row.teacherReviewStatus==='reviewed'&&current.teacherReviewStatus!=='reviewed'){best[key]=row;return;}
    if(Number(row.bestScore||row.score||0)>Number(current.bestScore||current.score||0)){best[key]=row;return;}
    if(String(row.updatedAt||'')>String(current.updatedAt||''))best[key]=row;
  });
  return Object.keys(best).map(function(k){return best[k];}).sort(function(a,b){
    var ai=EAP_CLOUD_RESUME_ROUTE_ORDER.indexOf(a.sessionId),bi=EAP_CLOUD_RESUME_ROUTE_ORDER.indexOf(b.sessionId);
    return ai!==bi?ai-bi:String(a.skill).localeCompare(String(b.skill));
  });
}
function eapCloudResumeMerge_(nested,direct){
  var out={},n=nested&&typeof nested==='object'?nested:{},d=direct&&typeof direct==='object'?direct:{};
  Object.keys(n).forEach(function(k){out[k]=n[k];});
  Object.keys(d).forEach(function(k){var v=d[k];if(v!==''&&v!==null&&v!==undefined)out[k]=v;});
  return out;
}
function eapCloudResumeParseJson_(value){try{var v=JSON.parse(String(value||'{}'));return v&&typeof v==='object'?v:{};}catch(_){return{};}}
function eapCloudResumeObject_(headers,row){var obj={};headers.forEach(function(h,i){if(h)obj[h]=row[i];});return obj;}
function eapCloudResumePick_(obj,keys){for(var i=0;i<keys.length;i++){var v=obj[keys[i]];if(v!==''&&v!==null&&v!==undefined)return v;}return '';}
function eapCloudResumeText_(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
function eapCloudResumeNumber_(v,fallback){var n=Number(v);return isFinite(n)?n:fallback;}
function eapCloudResumeBool_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'||String(v).toLowerCase()==='yes';}
function eapCloudResumeRouteId_(v){var raw=eapCloudResumeText_(v).toUpperCase(),m;if(/^\d+$/.test(raw))return'S'+Number(raw);m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/);if(m)return'S'+Number(m[1]);m=raw.match(/^B(?:OSS)?\s*0?([1-5])$/);if(m)return'B'+Number(m[1]);return raw;}
function eapCloudResumeSkill_(v){var s=eapCloudResumeText_(v).toLowerCase();return s?s.charAt(0).toUpperCase()+s.slice(1):'';}
function eapCloudResumeIsValidRoute_(routeId){return EAP_CLOUD_RESUME_ROUTE_ORDER.indexOf(eapCloudResumeRouteId_(routeId))>=0;}
function eapCloudResumeSpreadsheet_(){
  if(typeof eapSheetV132Spreadsheet_==='function')return eapSheetV132Spreadsheet_();
  if(typeof ss_==='function')return ss_();
  var id='';try{id=PropertiesService.getScriptProperties().getProperty('EAP_SPREADSHEET_ID')||'';}catch(_){}
  if(!id)throw new Error('EAP_SPREADSHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}
