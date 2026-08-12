/* =========================================================
   EAP Progress Authority v150
   SINGLE SOURCE OF TRUTH FOR COURSE PROGRESSION
   VERSION: 20260812-EAP-PROGRESS-AUTHORITY-V150

   DESIGN
   - EAP_Progress is the ONLY authority for unlock/resume.
   - Evidence/attempt/event sheets remain append-only research logs.
   - One row per section + studentId + routeId.
   - Every successful evidence submit upserts this sheet immediately.
   - Resume reads only EAP_Progress; it never reconstructs state from logs.
   - Best passed evidence is preserved; later lower attempts cannot erase pass.
========================================================= */

var EAP_PROGRESS_V150_VERSION = '20260812-EAP-PROGRESS-AUTHORITY-V150';
var EAP_PROGRESS_V150_SHEET = 'EAP_Progress';
var EAP_PROGRESS_V150_ORDER = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];
var EAP_PROGRESS_V150_REQUIRED = {
  S1:['Reading','Speaking'],
  S2:['Reading','Writing'],
  S3:['Reading','Writing'],
  B1:['Reading','Listening','Writing','Speaking'],
  S4:['Reading','Listening'],
  S5:['Reading','Speaking'],
  S6:['Writing','Reading'],
  B2:['Reading','Listening','Writing','Speaking'],
  S7:['Writing','Speaking'],
  S8:['Reading','Writing'],
  S9:['Writing','Speaking'],
  B3:['Reading','Listening','Writing','Speaking'],
  S10:['Writing','Reading'],
  S11:['Writing','Speaking'],
  S12:['Reading','Writing'],
  B4:['Reading','Listening','Writing','Speaking'],
  S13:['Listening','Writing'],
  S14:['Speaking','Writing'],
  S15:['Writing','Speaking'],
  B5:['Reading','Listening','Writing','Speaking']
};
var EAP_PROGRESS_V150_HEADERS = [
  'progressKey','studentKey','section','studentId','studentName','routeId','routeType',
  'readingScore','readingPassed','readingEvidenceId','readingUpdatedAt',
  'listeningScore','listeningPassed','listeningEvidenceId','listeningUpdatedAt',
  'writingScore','writingPassed','writingEvidenceId','writingUpdatedAt',
  'speakingScore','speakingPassed','speakingEvidenceId','speakingUpdatedAt','speakingReviewStatus',
  'requiredSkillCount','passedSkillCount','completed','updatedAt','sourceVersion'
];

function eapProgressV150Text_(v){
  return String(v == null ? '' : v).replace(/\s+/g,' ').trim();
}
function eapProgressV150Num_(v){
  var n = Number(v); return isFinite(n) ? n : 0;
}
function eapProgressV150Bool_(v){
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'yes';
}
function eapProgressV150Route_(v){
  var raw = eapProgressV150Text_(v).toUpperCase(), m;
  if(/^\d+$/.test(raw)) return 'S' + Number(raw);
  m = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i); if(m) return 'S' + Number(m[1]);
  m = raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i); if(m) return 'B' + Number(m[1]);
  return raw;
}
function eapProgressV150Skill_(v){
  var raw = eapProgressV150Text_(v).toLowerCase().replace(/[^a-z]/g,'');
  if(raw === 'reading' || raw === 'read') return 'Reading';
  if(raw === 'listening' || raw === 'listen') return 'Listening';
  if(raw === 'writing' || raw === 'write') return 'Writing';
  if(raw === 'speaking' || raw === 'speak') return 'Speaking';
  return '';
}
function eapProgressV150Spreadsheet_(){
  if(typeof eapSessionSpreadsheetV137_ === 'function') return eapSessionSpreadsheetV137_();
  if(typeof eapSheetV132Spreadsheet_ === 'function') return eapSheetV132Spreadsheet_();
  if(typeof ss_ === 'function') return ss_();
  var id = '';
  try{id = PropertiesService.getScriptProperties().getProperty('EAP_SPREADSHEET_ID') || '';}catch(_){ }
  if(!id) throw new Error('EAP_SPREADSHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}
function eapProgressV150HeaderMap_(headers){
  var map = {}; (headers || []).forEach(function(h,i){map[String(h || '')] = i;}); return map;
}
function eapProgressV150EnsureSheet_(){
  var ss = eapProgressV150Spreadsheet_();
  var sh = ss.getSheetByName(EAP_PROGRESS_V150_SHEET);
  if(!sh) sh = ss.insertSheet(EAP_PROGRESS_V150_SHEET);
  var current = sh.getLastColumn() > 0 ? sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String) : [];
  var headers = current.slice();
  EAP_PROGRESS_V150_HEADERS.forEach(function(h){if(headers.indexOf(h) < 0) headers.push(h);});
  if(headers.length){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
  }
  return {sheet:sh,headers:headers,map:eapProgressV150HeaderMap_(headers)};
}
function eapProgressV150Get_(obj,key){return obj && obj[key] !== undefined ? obj[key] : '';}
function eapProgressV150RowObject_(headers,row){
  var o = {}; (headers || []).forEach(function(h,i){o[h] = row[i];}); return o;
}
function eapProgressV150SkillPrefix_(skill){return String(skill || '').toLowerCase();}
function eapProgressV150ProgressKey_(section,studentId,routeId){return [section,studentId,routeId].join('|');}
function eapProgressV150StudentKey_(section,studentId){return [section,studentId].join('|');}

function eapProgressV150Recompute_(rowObj){
  var routeId = eapProgressV150Route_(rowObj.routeId);
  var required = EAP_PROGRESS_V150_REQUIRED[routeId] || [];
  var passedCount = 0;
  required.forEach(function(skill){
    var p = eapProgressV150SkillPrefix_(skill);
    if(eapProgressV150Bool_(rowObj[p + 'Passed'])) passedCount++;
  });
  rowObj.requiredSkillCount = required.length;
  rowObj.passedSkillCount = passedCount;
  rowObj.completed = required.length > 0 && passedCount === required.length;
  return rowObj;
}

function eapProgressUpsertV150_(payload,result){
  payload = payload || {}; result = result || {};
  var studentId = eapProgressV150Text_(payload.studentId || payload.student_id || payload.playerId || payload.id || result.studentId);
  var section = eapProgressV150Text_(payload.section || result.section || '122') || '122';
  var routeId = eapProgressV150Route_(payload.routeId || payload.sessionId || payload.session || payload.stage || result.routeId || result.sessionId);
  var skill = eapProgressV150Skill_(payload.skill || payload.skillName || payload.focusSkill || result.skill);
  if(!studentId || EAP_PROGRESS_V150_ORDER.indexOf(routeId) < 0 || !skill){
    return {ok:false,service:'eap-progress-authority',version:EAP_PROGRESS_V150_VERSION,error:'studentId, routeId and skill are required'};
  }

  var score = Math.max(
    eapProgressV150Num_(payload.score),
    eapProgressV150Num_(payload.bestScore),
    eapProgressV150Num_(payload.latestScore),
    eapProgressV150Num_(result.score),
    eapProgressV150Num_(result.bestScore),
    eapProgressV150Num_(result.latestScore)
  );
  var explicitPassed = eapProgressV150Bool_(payload.passed) || eapProgressV150Bool_(result.passed) ||
    eapProgressV150Bool_(payload.authoritativePassed) || eapProgressV150Bool_(result.authoritativePassed);
  var passed = explicitPassed || score >= 60;
  var reviewRequired = /^B[1-5]$/.test(routeId) && skill === 'Speaking';
  var reviewStatus = eapProgressV150Text_(payload.teacherReviewStatus || payload.reviewStatus || result.teacherReviewStatus).toLowerCase();
  if(reviewRequired && !explicitPassed){
    var reviewPassed = !!reviewStatus && /(reviewed|approved|accepted|pass|passed|complete|completed)/i.test(reviewStatus) &&
      !/(pending|revise|revision|rework|needs[_ -]?work|not[_ -]?reviewed)/i.test(reviewStatus);
    passed = passed && reviewPassed;
  }

  var evidenceId = eapProgressV150Text_(payload.evidenceId || payload.eventId || payload.rawEvidenceId || result.evidenceId || result.eventId);
  var studentName = eapProgressV150Text_(payload.studentName || payload.name || result.studentName || 'Student');
  var now = new Date().toISOString();
  var key = eapProgressV150ProgressKey_(section,studentId,routeId);
  var target = eapProgressV150EnsureSheet_();
  var sh = target.sheet, headers = target.headers, map = target.map;
  var rowNumber = -1;

  if(sh.getLastRow() >= 2){
    var matches = sh.getRange(2,map.progressKey + 1,sh.getLastRow()-1,1)
      .createTextFinder(key).matchEntireCell(true).findAll();
    if(matches.length) rowNumber = matches[matches.length-1].getRow();
  }

  var rowObj = {};
  headers.forEach(function(h){rowObj[h] = '';});
  if(rowNumber > 0){
    rowObj = eapProgressV150RowObject_(headers,sh.getRange(rowNumber,1,1,headers.length).getValues()[0]);
  }

  rowObj.progressKey = key;
  rowObj.studentKey = eapProgressV150StudentKey_(section,studentId);
  rowObj.section = section;
  rowObj.studentId = studentId;
  rowObj.studentName = studentName || rowObj.studentName || 'Student';
  rowObj.routeId = routeId;
  rowObj.routeType = /^B/.test(routeId) ? 'boss_gate' : 'normal_session';

  var p = eapProgressV150SkillPrefix_(skill);
  var oldScore = eapProgressV150Num_(rowObj[p + 'Score']);
  var oldPassed = eapProgressV150Bool_(rowObj[p + 'Passed']);
  var shouldReplaceEvidence = !oldPassed && passed || score >= oldScore;
  rowObj[p + 'Score'] = Math.max(oldScore,score);
  rowObj[p + 'Passed'] = oldPassed || passed;
  if(shouldReplaceEvidence || !rowObj[p + 'EvidenceId']) rowObj[p + 'EvidenceId'] = evidenceId || rowObj[p + 'EvidenceId'];
  if(shouldReplaceEvidence || !rowObj[p + 'UpdatedAt']) rowObj[p + 'UpdatedAt'] = now;
  if(skill === 'Speaking') rowObj.speakingReviewStatus = reviewStatus || rowObj.speakingReviewStatus || '';

  rowObj.updatedAt = now;
  rowObj.sourceVersion = EAP_PROGRESS_V150_VERSION;
  eapProgressV150Recompute_(rowObj);

  var row = headers.map(function(h){return rowObj[h] === undefined ? '' : rowObj[h];});
  if(rowNumber > 0) sh.getRange(rowNumber,1,1,headers.length).setValues([row]);
  else {sh.appendRow(row); rowNumber = sh.getLastRow();}
  SpreadsheetApp.flush();

  return {
    ok:true,service:'eap-progress-authority',version:EAP_PROGRESS_V150_VERSION,
    studentId:studentId,section:section,routeId:routeId,skill:skill,
    score:rowObj[p + 'Score'],passed:rowObj[p + 'Passed'],
    passedSkillCount:rowObj.passedSkillCount,requiredSkillCount:rowObj.requiredSkillCount,
    completed:rowObj.completed,rowNumber:rowNumber
  };
}

function eapProgressReadStudentV150_(studentId,section){
  var target = eapProgressV150EnsureSheet_();
  var sh = target.sheet, headers = target.headers, map = target.map;
  if(sh.getLastRow() < 2) return [];
  var studentKey = eapProgressV150StudentKey_(section,studentId);
  var matches = sh.getRange(2,map.studentKey + 1,sh.getLastRow()-1,1)
    .createTextFinder(studentKey).matchEntireCell(true).findAll();
  var rows = [];
  matches.forEach(function(cell){
    rows.push(eapProgressV150RowObject_(headers,sh.getRange(cell.getRow(),1,1,headers.length).getValues()[0]));
  });
  return rows;
}

function eapPlayerResumeV150_(params){
  params = params || {};
  var started = Date.now();
  var studentId = eapProgressV150Text_(params.studentId || params.id || params.playerId);
  var section = eapProgressV150Text_(params.section || '122') || '122';
  if(!studentId) return {ok:false,service:'eap-progress-authority',version:EAP_PROGRESS_V150_VERSION,error:'missing_studentId'};

  var rows = eapProgressReadStudentV150_(studentId,section);
  var byRoute = {};
  rows.forEach(function(r){byRoute[eapProgressV150Route_(r.routeId)] = r;});
  var routeProgress = {}, passedRoutes = [], currentRoute = '';

  EAP_PROGRESS_V150_ORDER.forEach(function(routeId){
    var required = (EAP_PROGRESS_V150_REQUIRED[routeId] || []).slice();
    var row = byRoute[routeId] || {};
    var skills = {}, passedCount = 0;
    required.forEach(function(skill){
      var p = eapProgressV150SkillPrefix_(skill);
      var rec = {
        routeId:routeId,sessionId:routeId,skill:skill,
        score:eapProgressV150Num_(row[p + 'Score']),
        bestScore:eapProgressV150Num_(row[p + 'Score']),
        latestScore:eapProgressV150Num_(row[p + 'Score']),
        passed:eapProgressV150Bool_(row[p + 'Passed']),
        evidenceId:eapProgressV150Text_(row[p + 'EvidenceId']),
        updatedAt:eapProgressV150Text_(row[p + 'UpdatedAt']),
        teacherReviewStatus:skill === 'Speaking' ? eapProgressV150Text_(row.speakingReviewStatus) : ''
      };
      skills[skill] = rec;
      if(rec.passed) passedCount++;
    });
    var complete = required.length > 0 && passedCount === required.length;
    routeProgress[routeId] = {
      routeId:routeId,routeType:/^B/.test(routeId) ? 'boss_gate' : 'normal_session',
      requiredSkills:required,requiredSkillCount:required.length,passedSkillCount:passedCount,
      skills:skills,completed:complete,passed:complete
    };
    if(!currentRoute && complete) passedRoutes.push(routeId);
    else if(!currentRoute) currentRoute = routeId;
  });

  var courseCompleted = !currentRoute;
  if(courseCompleted) currentRoute = 'B5';
  var unlockedRouteList = passedRoutes.slice();
  if(unlockedRouteList.indexOf(currentRoute) < 0) unlockedRouteList.push(currentRoute);
  var unlockedRoutes = {}, unlockedSessions = {};
  unlockedRouteList.forEach(function(r){
    unlockedRoutes[r] = true;
    var m = r.match(/^S(\d+)$/); if(m) unlockedSessions[String(Number(m[1]))] = true;
  });

  return {
    ok:true,service:'eap-progress-authority',version:EAP_PROGRESS_V150_VERSION,
    authorityMode:'EAP_Progress-single-source-of-truth',studentId:studentId,section:section,
    recordCount:rows.length,progressRows:rows,routeProgress:routeProgress,sessionProgress:routeProgress,
    passedRoutes:passedRoutes,completedRoutes:passedRoutes,currentRoute:currentRoute,currentCloudRoute:currentRoute,
    nextRoute:currentRoute,unlockedRouteList:unlockedRouteList,unlockedRoutes:unlockedRoutes,
    unlockedSessions:unlockedSessions,courseCompleted:courseCompleted,
    requiredSkillsByRoute:EAP_PROGRESS_V150_REQUIRED,generatedAt:new Date().toISOString(),
    elapsedMs:Date.now()-started
  };
}

function eapProgressSetupV150_(){
  var target = eapProgressV150EnsureSheet_();
  return {ok:true,service:'eap-progress-authority',version:EAP_PROGRESS_V150_VERSION,sheet:EAP_PROGRESS_V150_SHEET,headers:target.headers};
}

/* One-time migration helper. Run manually from Apps Script for a test student first.
   It scans direct studentId columns in legacy sources, normalizes payload JSON when present,
   and upserts best evidence into EAP_Progress. It is NOT used by normal resume. */
function eapProgressMigrateStudentV150_(studentId,section,sourceStudentId){
  studentId = eapProgressV150Text_(studentId);
  section = eapProgressV150Text_(section || '122') || '122';
  sourceStudentId = eapProgressV150Text_(sourceStudentId || studentId);
  if(!studentId) return {ok:false,error:'studentId required'};
  var ss = eapProgressV150Spreadsheet_();
  var sourceNames = ['EAP_Summary','summary','EAP_Attempts','attempts','EAP_Evidence','evidence','events','eap-v132-events','eap-v132-quality-audit'];
  var migrated = 0, scanned = [], skipped = [];

  sourceNames.forEach(function(name){
    var sh = ss.getSheetByName(name); if(!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return;
    scanned.push(name);
    var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
    var sidCol = -1;
    ['studentId','student_id','playerId','id'].some(function(h){var i=headers.indexOf(h); if(i>=0){sidCol=i; return true;} return false;});
    if(sidCol < 0){skipped.push(name + ':no-studentId-column'); return;}
    var matches = sh.getRange(2,sidCol+1,sh.getLastRow()-1,1).createTextFinder(sourceStudentId).matchEntireCell(true).findAll();
    matches.forEach(function(cell){
      var row = sh.getRange(cell.getRow(),1,1,headers.length).getValues()[0];
      var direct = {}; headers.forEach(function(h,i){direct[h]=row[i];});
      var nested = {};
      ['valueJson','rawJson','payloadJson','evidenceJson','payload','dataJson','json'].some(function(k){
        if(direct[k]){try{nested=JSON.parse(String(direct[k]));}catch(_){nested={};} return true;} return false;
      });
      if(nested && nested.payload && typeof nested.payload === 'object') nested = Object.assign({},nested.payload,nested);
      if(nested && nested.data && typeof nested.data === 'object') nested = Object.assign({},nested.data,nested);
      var o = Object.assign({},nested,direct);
      var routeId = eapProgressV150Route_(o.routeId || o.sessionId || o.session || o.stage || o.weekId);
      var skill = eapProgressV150Skill_(o.skill || o.skillName || o.focusSkill);
      if(EAP_PROGRESS_V150_ORDER.indexOf(routeId) < 0 || !skill) return;
      var payload = Object.assign({},o,{
        studentId:studentId,section:section,routeId:routeId,sessionId:routeId,skill:skill,
        score:Math.max(eapProgressV150Num_(o.bestScore),eapProgressV150Num_(o.latestScore),eapProgressV150Num_(o.score),eapProgressV150Num_(o.autoScore)),
        passed:eapProgressV150Bool_(o.passed) || eapProgressV150Bool_(o.authoritativePassed) || eapProgressV150Bool_(o.verifiedPassed),
        evidenceId:o.evidenceId || o.eventId || '',studentName:o.studentName || o.name || 'Student'
      });
      var r = eapProgressUpsertV150_(payload,{}); if(r && r.ok) migrated++;
    });
  });
  return {ok:true,service:'eap-progress-authority',version:EAP_PROGRESS_V150_VERSION,studentId:studentId,sourceStudentId:sourceStudentId,section:section,migrated:migrated,scanned:scanned,skipped:skipped};
}

function EAP_progressSetupV150(){return eapProgressSetupV150_();}
function EAP_progressMigrate50V150(){return eapProgressMigrateStudentV150_('50','122','50');}
function EAP_progressMigrate50LegacyV150(){return eapProgressMigrateStudentV150_('50','122','6811000000');}
function EAP_progressResume50V150(){var r=eapPlayerResumeV150_({studentId:'50',section:'122'}); Logger.log(JSON.stringify(r)); return r;}
