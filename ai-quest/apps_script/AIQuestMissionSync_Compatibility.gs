/**
 * CSAI2102 AI Quest • Mission Sync Compatibility Receiver
 * Version: 2026-08-11-MISSION-SYNC-COMPAT-V2
 *
 * PURPOSE
 * - Receive action=sync_v23, kind=attempt from Graded Mission.
 * - Write graded Mission evidence to session_attempts.
 * - Preserve existing session_attempts schema; do not rewrite/extend an existing header row.
 * - Idempotent by attemptId.
 * - Return precise errorStep/errorMessage instead of throwing opaque handler errors.
 *
 * No doGet/doPost here. Central Code.gs routes sync_v23 to AIQMISSION.handle().
 */
var AIQMISSION = AIQMISSION || {};

AIQMISSION.VERSION = '2026-08-11-MISSION-SYNC-COMPAT-V2';
AIQMISSION.SHEET = 'session_attempts';
AIQMISSION.SECTION = '101';

AIQMISSION.REQUIRED_HEADERS = [
  'serverTs','attemptId','studentId','studentName','section','sessionId','missionId','missionTitle','difficulty',
  'score','stars','mastered','usedTimeSec','timeLeftSec','accuracy','correct','total','wrong','maxCombo',
  'helpUsed','trickCorrect','trickTotal','explainCorrect','explainTotal','bossWin','misconceptionsJson',
  'wrongItemsJson','reflection1','reflection2','reflection3','clientTs','userAgent','pageUrl','version','extraJson'
];

AIQMISSION.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQMISSION.norm_ = function(v){ return AIQMISSION.text_(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,''); };
AIQMISSION.bool_ = function(v){
  return v === true || ['true','1','yes','passed','pass','completed','mastered','success','ok'].indexOf(AIQMISSION.text_(v).toLowerCase()) >= 0;
};
AIQMISSION.num_ = function(v){
  if (v === '' || v === null || typeof v === 'undefined') return 0;
  var n = Number(String(v).replace(/,/g,'').replace(/%$/,''));
  return isFinite(n) ? n : 0;
};
AIQMISSION.now_ = function(){
  return Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX");
};
AIQMISSION.session_ = function(v){
  var s = AIQMISSION.text_(v).toUpperCase().replace(/[\s_:\-]+/g,'');
  if (/^\d+$/.test(s)) s = 'S' + s;
  if (/^M\d+$/.test(s)) s = 'S' + s.slice(1);
  var m = s.match(/^(S(?:1[0-5]|[1-9])|B[1-5])$/);
  return m ? m[1] : '';
};
AIQMISSION.safeObject_ = function(v){
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  try {
    var x = JSON.parse(String(v || '{}'));
    return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  } catch(e){ return {}; }
};
AIQMISSION.stringify_ = function(v){
  try { return JSON.stringify(v == null ? {} : v); }
  catch(e){ return '{}'; }
};
AIQMISSION.headerIndex_ = function(headers,names){
  for (var i=0;i<names.length;i++) {
    var target = AIQMISSION.norm_(names[i]);
    for (var j=0;j<headers.length;j++) {
      if (AIQMISSION.norm_(headers[j]) === target) return j;
    }
  }
  return -1;
};
AIQMISSION.ss_ = function(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SPREADSHEET_NOT_FOUND');
  return ss;
};
AIQMISSION.sheet_ = function(){
  var ss = AIQMISSION.ss_();
  var sh = ss.getSheetByName(AIQMISSION.SHEET);
  if (!sh) {
    sh = ss.insertSheet(AIQMISSION.SHEET);
    sh.getRange(1,1,1,AIQMISSION.REQUIRED_HEADERS.length).setValues([AIQMISSION.REQUIRED_HEADERS]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,AIQMISSION.REQUIRED_HEADERS.length).setValues([AIQMISSION.REQUIRED_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
};
AIQMISSION.headers_ = function(sh){
  var lastCol = Math.max(1, sh.getLastColumn());
  return sh.getRange(1,1,1,lastCol).getDisplayValues()[0];
};
AIQMISSION.requestExists_ = function(sh,headers,attemptId){
  attemptId = AIQMISSION.text_(attemptId);
  if (!attemptId || sh.getLastRow() < 2) return false;
  var idx = AIQMISSION.headerIndex_(headers,['attemptId','attempt_id']);
  if (idx < 0) return false;
  var finder = sh.getRange(2,idx+1,sh.getLastRow()-1,1)
    .createTextFinder(attemptId).matchEntireCell(true).findNext();
  return !!finder;
};
AIQMISSION.rowForHeaders_ = function(headers,obj){
  var lookup = {};
  Object.keys(obj || {}).forEach(function(k){ lookup[AIQMISSION.norm_(k)] = obj[k]; });
  return headers.map(function(h){
    var v = lookup[AIQMISSION.norm_(h)];
    if (v === null || typeof v === 'undefined') return '';
    if (v && typeof v === 'object') return AIQMISSION.stringify_(v);
    return v;
  });
};
AIQMISSION.submitAttempt_ = function(raw){
  var step = 'START';
  try {
    raw = raw || {};
    var p = raw.payload && typeof raw.payload === 'object' ? raw.payload : raw;

    step = 'NORMALIZE_INPUT';
    var studentId = AIQMISSION.text_(p.studentId || p.student_id);
    var studentName = AIQMISSION.text_(p.studentName || p.student_name || p.name);
    var section = AIQMISSION.text_(p.section || AIQMISSION.SECTION) || AIQMISSION.SECTION;
    var sessionId = AIQMISSION.session_(p.sessionId || p.session_id || p.missionId || p.mission_id || p.mission);
    var attemptId = AIQMISSION.text_(p.attemptId || p.attempt_id) || ('mission_' + studentId + '_' + sessionId + '_' + Date.now());
    var score = AIQMISSION.num_(p.score != null ? p.score : p.accuracy);
    var correct = AIQMISSION.num_(p.correct);
    var total = AIQMISSION.num_(p.total);
    var isPractice = AIQMISSION.bool_(p.isPractice);
    var mode = AIQMISSION.text_(p.runMode || p.difficulty).toLowerCase();
    var isGraded = p.isGraded === true || mode === 'graded' || mode.indexOf('graded') >= 0;
    var pass = AIQMISSION.bool_(p.passed) || AIQMISSION.text_(p.gateStatus).toLowerCase() === 'passed' || score >= 60;

    if (!studentId) return {ok:false,code:'STUDENT_ID_REQUIRED',errorStep:step,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
    if (!sessionId) return {ok:false,code:'SESSION_ID_REQUIRED',errorStep:step,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
    if (isPractice || !isGraded) return {ok:false,code:'MISSION_GRADED_EVIDENCE_REQUIRED',errorStep:step,isPractice:isPractice,isGraded:isGraded,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};

    step = 'OPEN_SHEET';
    var sh = AIQMISSION.sheet_();
    var headers = AIQMISSION.headers_(sh);
    if (!headers.length) return {ok:false,code:'SESSION_ATTEMPTS_HEADERS_MISSING',errorStep:step,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};

    step = 'CHECK_DUPLICATE';
    if (AIQMISSION.requestExists_(sh,headers,attemptId)) {
      return {ok:true,action:'sync_v23',kind:'attempt',duplicate:true,saved:true,attemptId:attemptId,studentId:studentId,sessionId:sessionId,score:score,passed:pass,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
    }

    step = 'BUILD_ROW';
    var extra = AIQMISSION.safeObject_(p.extraJson || {});
    extra.isPractice = false;
    extra.isGraded = true;
    extra.runMode = 'graded';
    extra.gateStatus = pass ? 'passed' : 'review';
    extra.raw = p;

    var obj = {
      serverTs:AIQMISSION.now_(),
      attemptId:attemptId,
      studentId:studentId,
      studentName:studentName,
      section:section,
      sessionId:sessionId,
      missionId:sessionId,
      missionTitle:AIQMISSION.text_(p.missionTitle || sessionId),
      difficulty:'graded',
      score:score,
      stars:AIQMISSION.num_(p.stars),
      mastered:AIQMISSION.bool_(p.mastered),
      usedTimeSec:AIQMISSION.num_(p.usedTimeSec),
      timeLeftSec:AIQMISSION.num_(p.timeLeftSec),
      accuracy:score,
      correct:correct,
      total:total,
      wrong:AIQMISSION.num_(p.wrong),
      maxCombo:AIQMISSION.num_(p.maxCombo),
      helpUsed:AIQMISSION.num_(p.helpUsed),
      trickCorrect:AIQMISSION.num_(p.trickCorrect),
      trickTotal:AIQMISSION.num_(p.trickTotal),
      explainCorrect:AIQMISSION.num_(p.explainCorrect),
      explainTotal:AIQMISSION.num_(p.explainTotal),
      bossWin:AIQMISSION.bool_(p.bossWin),
      misconceptionsJson:p.misconceptions || {},
      wrongItemsJson:p.wrongItems || extra.wrongItems || [],
      reflection1:'', reflection2:'', reflection3:'',
      clientTs:AIQMISSION.text_(p.clientTs),
      userAgent:AIQMISSION.text_(p.userAgent),
      pageUrl:AIQMISSION.text_(p.pageUrl),
      version:AIQMISSION.text_(p.schemaVersion || AIQMISSION.VERSION),
      extraJson:extra
    };
    var row = AIQMISSION.rowForHeaders_(headers,obj);

    step = 'WRITE_ROW';
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var targetRow = Math.max(2, sh.getLastRow() + 1);
      sh.getRange(targetRow,1,1,headers.length).setValues([row]);
      SpreadsheetApp.flush();
    } finally {
      try { lock.releaseLock(); } catch(ignore) {}
    }

    step = 'VERIFY_WRITE';
    var saved = AIQMISSION.requestExists_(sh,headers,attemptId);
    if (!saved) return {ok:false,code:'MISSION_WRITE_NOT_VERIFIED',errorStep:step,attemptId:attemptId,version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};

    return {
      ok:true,action:'sync_v23',kind:'attempt',saved:true,duplicate:false,
      attemptId:attemptId,studentId:studentId,sessionId:sessionId,
      score:score,correct:correct,total:total,passed:pass,
      version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()
    };
  } catch(e) {
    return {
      ok:false,
      code:'MISSION_SYNC_INTERNAL_ERROR',
      errorStep:step,
      errorMessage:String(e && e.message || e),
      version:AIQMISSION.VERSION,
      serverTs:AIQMISSION.now_()
    };
  }
};

AIQMISSION.handle = function(payload){
  payload = payload || {};
  var action = AIQMISSION.text_(payload.action).toLowerCase();
  var kind = AIQMISSION.text_(payload.kind).toLowerCase();
  if (action === 'sync_v23' && kind === 'attempt') return AIQMISSION.submitAttempt_(payload);
  return {ok:false,code:'UNKNOWN_MISSION_SYNC_ACTION',action:payload.action||'',kind:payload.kind||'',version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
};

/** Manual editor test: does not write a student row. */
function AIQMISSION_diagnostic_(){
  var report = {version:AIQMISSION.VERSION,serverTs:AIQMISSION.now_()};
  try {
    var sh = AIQMISSION.sheet_();
    report.ok = true;
    report.sheet = sh.getName();
    report.rows = sh.getLastRow();
    report.columns = sh.getLastColumn();
    report.headers = AIQMISSION.headers_(sh);
  } catch(e) {
    report.ok = false;
    report.error = String(e && e.message || e);
  }
  Logger.log(JSON.stringify(report,null,2));
  return report;
}
