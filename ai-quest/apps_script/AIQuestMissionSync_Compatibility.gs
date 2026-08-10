/**
 * CSAI2102 AI Quest • Mission Sync Compatibility Receiver
 * Version: 2026-08-10-MISSION-SYNC-COMPAT-V1
 *
 * PURPOSE
 * - Restore action=sync_v23, kind=attempt mission writes after the central
 *   Code.gs router was replaced by the unified AIQ router.
 * - Write graded Mission evidence to session_attempts in a schema-tolerant way.
 * - No doGet/doPost here. Central Code.gs must route sync_v23 to AIQMISSION.handle().
 */
var AIQMISSION = AIQMISSION || {};
AIQMISSION.VERSION = '2026-08-10-MISSION-SYNC-COMPAT-V1';
AIQMISSION.SHEET = 'session_attempts';
AIQMISSION.SECTION = '101';

AIQMISSION.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQMISSION.bool_ = function(v){
  return v === true || ['true','1','yes','passed','pass','completed','mastered'].indexOf(AIQMISSION.text_(v).toLowerCase()) >= 0;
};
AIQMISSION.num_ = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
AIQMISSION.now_ = function(){ return Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX"); };
AIQMISSION.norm_ = function(v){ return AIQMISSION.text_(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,''); };
AIQMISSION.session_ = function(v){
  var s = AIQMISSION.text_(v).toUpperCase().replace(/[\s_:\-]+/g,'');
  if (/^\d+$/.test(s)) s = 'S' + s;
  if (/^M\d+$/.test(s)) s = 'S' + s.slice(1);
  return s;
};
AIQMISSION.safeJson_ = function(v){
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v || '{}')); } catch(e){ return {}; }
};
AIQMISSION.headerIndex_ = function(headers,names){
  for (var i=0;i<names.length;i++) {
    var target = AIQMISSION.norm_(names[i]);
    for (var j=0;j<headers.length;j++) if (AIQMISSION.norm_(headers[j]) === target) return j;
  }
  return -1;
};
AIQMISSION.ensureSheet_ = function(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SPREADSHEET_NOT_FOUND');
  var sh = ss.getSheetByName(AIQMISSION.SHEET);
  var required = [
    'serverTs','attemptId','studentId','studentName','section','sessionId','missionId','missionTitle','difficulty',
    'score','stars','mastered','usedTimeSec','timeLeftSec','accuracy','correct','total','wrong','maxCombo',
    'helpUsed','trickCorrect','trickTotal','explainCorrect','explainTotal','bossWin','misconceptionsJson',
    'wrongItemsJson','reflection1','reflection2','reflection3','clientTs','userAgent','pageUrl','version','extraJson'
  ];
  if (!sh) sh = ss.insertSheet(AIQMISSION.SHEET);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,required.length).setValues([required]);
    sh.setFrozenRows(1);
    return sh;
  }
  var lastCol = Math.max(1,sh.getLastColumn());
  var headers = sh.getRange(1,1,1,lastCol).getDisplayValues()[0];
  var known = {}; headers.forEach(function(h){ if(h) known[AIQMISSION.norm_(h)] = true; });
  var missing = required.filter(function(h){ return !known[AIQMISSION.norm_(h)]; });
  if (missing.length) sh.getRange(1,lastCol+1,1,missing.length).setValues([missing]);
  return sh;
};
AIQMISSION.rowFromObject_ = function(headers,obj){
  var lookup = {};
  Object.keys(obj).forEach(function(k){ lookup[AIQMISSION.norm_(k)] = obj[k]; });
  return headers.map(function(h){
    var v = lookup[AIQMISSION.norm_(h)];
    if (v && typeof v === 'object') return JSON.stringify(v);
    return v == null ? '' : v;
  });
};
AIQMISSION.requestExists_ = function(sh,attemptId){
  attemptId = AIQMISSION.text_(attemptId);
  if (!attemptId || sh.getLastRow() < 2) return false;
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  var idx = AIQMISSION.headerIndex_(headers,['attemptId','attempt_id']);
  if (idx < 0) return false;
  return !!sh.getRange(2,idx+1,sh.getLastRow()-1,1).createTextFinder(attemptId).matchEntireCell(true).findNext();
};
AIQMISSION.submitAttempt_ = function(raw){
  raw = raw || {};
  var p = raw.payload && typeof raw.payload === 'object' ? raw.payload : raw;
  var studentId = AIQMISSION.text_(p.studentId || p.student_id);
  var studentName = AIQMISSION.text_(p.studentName || p.student_name || p.name);
  var section = AIQMISSION.text_(p.section || AIQMISSION.SECTION) || AIQMISSION.SECTION;
  var sessionId = AIQMISSION.session_(p.sessionId || p.session_id || p.missionId || p.mission_id || p.mission);
  var attemptId = AIQMISSION.text_(p.attemptId || p.attempt_id) || ('mission_' + studentId + '_' + sessionId + '_' + Date.now());
  var score = AIQMISSION.num_(p.score || p.accuracy);
  var total = AIQMISSION.num_(p.total);
  var correct = AIQMISSION.num_(p.correct);
  var pass = AIQMISSION.bool_(p.passed) || AIQMISSION.text_(p.gateStatus).toLowerCase() === 'passed' || score >= 60;
  var isPractice = AIQMISSION.bool_(p.isPractice);
  var isGraded = p.isGraded === true || AIQMISSION.text_(p.runMode).toLowerCase() === 'graded' || AIQMISSION.text_(p.difficulty).toLowerCase() === 'graded';
  if (!studentId) throw new Error('STUDENT_ID_REQUIRED');
  if (!sessionId) throw new Error('SESSION_ID_REQUIRED');
  if (isPractice || !isGraded) throw new Error('MISSION_GRADED_EVIDENCE_REQUIRED');
  var sh = AIQMISSION.ensureSheet_();
  if (AIQMISSION.requestExists_(sh,attemptId)) {
    return {ok:true,action:'sync_v23',kind:'attempt',duplicate:true,attemptId:attemptId,studentId:studentId,sessionId:sessionId,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
  }
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  var extra = AIQMISSION.safeJson_(p.extraJson || {});
  extra.isPractice = false;
  extra.isGraded = true;
  extra.runMode = 'graded';
  extra.gateStatus = pass ? 'passed' : 'review';
  extra.raw = p;
  var obj = {
    serverTs:AIQMISSION.now_(), attemptId:attemptId, studentId:studentId, studentName:studentName,
    section:section, sessionId:sessionId, missionId:sessionId, missionTitle:AIQMISSION.text_(p.missionTitle || sessionId),
    difficulty:'graded', score:score, stars:AIQMISSION.num_(p.stars), mastered:AIQMISSION.bool_(p.mastered),
    usedTimeSec:AIQMISSION.num_(p.usedTimeSec), timeLeftSec:AIQMISSION.num_(p.timeLeftSec), accuracy:score,
    correct:correct, total:total, wrong:AIQMISSION.num_(p.wrong), maxCombo:AIQMISSION.num_(p.maxCombo),
    helpUsed:AIQMISSION.num_(p.helpUsed), trickCorrect:AIQMISSION.num_(p.trickCorrect), trickTotal:AIQMISSION.num_(p.trickTotal),
    explainCorrect:AIQMISSION.num_(p.explainCorrect), explainTotal:AIQMISSION.num_(p.explainTotal), bossWin:AIQMISSION.bool_(p.bossWin),
    misconceptionsJson:p.misconceptions || {}, wrongItemsJson:p.wrongItems || extra.wrongItems || [],
    reflection1:'',reflection2:'',reflection3:'',clientTs:AIQMISSION.text_(p.clientTs),userAgent:AIQMISSION.text_(p.userAgent),
    pageUrl:AIQMISSION.text_(p.pageUrl),version:AIQMISSION.text_(p.schemaVersion || AIQMISSION.VERSION),extraJson:extra
  };
  sh.appendRow(AIQMISSION.rowFromObject_(headers,obj));
  SpreadsheetApp.flush();
  return {ok:true,action:'sync_v23',kind:'attempt',saved:true,attemptId:attemptId,studentId:studentId,sessionId:sessionId,score:score,passed:pass,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
};
AIQMISSION.handle = function(payload){
  payload = payload || {};
  var action = AIQMISSION.text_(payload.action).toLowerCase();
  var kind = AIQMISSION.text_(payload.kind).toLowerCase();
  if (action === 'sync_v23' && kind === 'attempt') return AIQMISSION.submitAttempt_(payload);
  return {ok:false,code:'UNKNOWN_MISSION_SYNC_ACTION',action:payload.action||'',kind:payload.kind||'',version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
};
