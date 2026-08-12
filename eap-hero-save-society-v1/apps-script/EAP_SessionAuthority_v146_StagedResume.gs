/* =========================================================
   EAP Session Authority v146
   STAGED CURRENT-ROUTE RESUME
   VERSION: 20260812-EAP-SESSION-AUTHORITY-V146-STAGED-CURRENT-ROUTE

   DESIGN
   1) Read compact summary sheets as the historical base.
   2) Build progress once to identify the current route.
   3) Read ONLY a bounded tail window from evidence/attempt/event sheets.
   4) Keep only evidence for the current route, merge + dedupe, rebuild progress.
   5) Google Sheet remains the sole authority.

   This file intentionally contains no doGet()/doPost().
========================================================= */

var EAP_SESSION_AUTHORITY_V146 =
  '20260812-EAP-SESSION-AUTHORITY-V146-STAGED-CURRENT-ROUTE';
var EAP_SESSION_V146_CACHE_SEC = 15;
var EAP_SESSION_V146_TAIL_ROWS = 2000;

var EAP_SESSION_V146_ORDER = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];

var EAP_SESSION_V146_REQUIRED = {
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

var EAP_SESSION_V146_BASE_SHEETS = ['EAP_Summary','summary'];
var EAP_SESSION_V146_TAIL_SHEETS = [
  'EAP_Attempts','attempts','EAP_Evidence','evidence',
  'events','eap-v132-events','eap-v132-quality-audit'
];

var EAP_SESSION_V146_LEGACY_TEST_ALIASES = {'122|50':'6811000000'};

function eapV146Text_(v){return String(v == null ? '' : v).replace(/\s+/g,' ').trim();}
function eapV146Num_(v){var n=Number(v);return isFinite(n)?n:0;}
function eapV146Bool_(v){var s=String(v).toLowerCase();return v===true||s==='true'||s==='1'||s==='yes'||s==='passed'||s==='pass';}
function eapV146HeaderKey_(v){return eapV146Text_(v).toLowerCase().replace(/[^a-z0-9]/g,'');}
function eapV146Route_(v){
  var raw=eapV146Text_(v).toUpperCase(),m;
  if(/^\d+$/.test(raw)) return 'S'+Number(raw);
  m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i); if(m) return 'S'+Number(m[1]);
  m=raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i); if(m) return 'B'+Number(m[1]);
  return raw;
}
function eapV146Skill_(v){
  var raw=eapV146Text_(v).toLowerCase().replace(/[^a-z]/g,'');
  if(raw==='reading'||raw==='read') return 'Reading';
  if(raw==='listening'||raw==='listen') return 'Listening';
  if(raw==='writing'||raw==='write') return 'Writing';
  if(raw==='speaking'||raw==='speak') return 'Speaking';
  return '';
}
function eapV146Spreadsheet_(){
  if(typeof eapSessionSpreadsheetV137_==='function') return eapSessionSpreadsheetV137_();
  if(typeof eapSheetV132Spreadsheet_==='function') return eapSheetV132Spreadsheet_();
  if(typeof ss_==='function') return ss_();
  var id=''; try{id=PropertiesService.getScriptProperties().getProperty('EAP_SPREADSHEET_ID')||'';}catch(_){}
  if(!id) throw new Error('EAP_SPREADSHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}
function eapV146Obj_(headers,row){var o={};(headers||[]).forEach(function(h,i){var k=eapV146Text_(h);if(k)o[k]=row[i];});return o;}
function eapV146Pick_(o,names){
  var keys=Object.keys(o||{});
  for(var i=0;i<names.length;i++){
    var target=eapV146HeaderKey_(names[i]);
    for(var j=0;j<keys.length;j++){
      if(eapV146HeaderKey_(keys[j])===target){var v=o[keys[j]];if(v!==''&&v!==null&&v!==undefined)return v;}
    }
  }
  return '';
}
function eapV146ParseJson_(v){try{var o=JSON.parse(String(v||'{}'));return o&&typeof o==='object'?o:{};}catch(_){return {};}}
function eapV146Merge_(a,b){var o={};Object.keys(a||{}).forEach(function(k){o[k]=a[k];});Object.keys(b||{}).forEach(function(k){var v=b[k];if(v!==''&&v!==null&&v!==undefined)o[k]=v;});return o;}
function eapV146Nested_(direct){
  var raw=eapV146Pick_(direct,['valueJson','rawJson','payloadJson','evidenceJson','payload','dataJson','json']);
  var n=eapV146ParseJson_(raw);
  if(n&&n.payload&&typeof n.payload==='object') n=eapV146Merge_(n.payload,n);
  if(n&&n.data&&typeof n.data==='object') n=eapV146Merge_(n.data,n);
  return n;
}
function eapV146Normalize_(o,sourceSheet,requestedStudentId,sourceStudentId,section,routeFilter){
  var sid=eapV146Text_(eapV146Pick_(o,['studentId','student_id','playerId','id']));
  if(sid!==sourceStudentId) return null;
  var sec=eapV146Text_(eapV146Pick_(o,['section','classGroup','class','group']))||section;
  if(sec!==section) return null;
  var route=eapV146Route_(eapV146Pick_(o,['routeId','sessionId','session','missionId','stage','weekId']));
  if(EAP_SESSION_V146_ORDER.indexOf(route)<0) return null;
  if(routeFilter&&route!==routeFilter) return null;
  var skill=eapV146Skill_(eapV146Pick_(o,['skill','skillName','skillKey','focusSkill']));
  if(!skill) return null;
  var score=eapV146Num_(eapV146Pick_(o,['bestScore','latestScore','score','teacherScore','missionScore','autoScore']));
  var explicitPassed=eapV146Bool_(eapV146Pick_(o,['passed','pass','mastered','verifiedPassed','authoritativePassed']));
  var passed=explicitPassed||score>=60;
  var reviewStatus=eapV146Text_(eapV146Pick_(o,['teacherReviewStatus','reviewStatus'])).toLowerCase();
  var reviewRequired=/^B[1-5]$/.test(route)&&skill==='Speaking';
  if(reviewRequired&&!explicitPassed){
    var reviewPassed=!!reviewStatus&&!/(pending|revise|revision|rework|needs[_ -]?work|not[_ -]?reviewed)/i.test(reviewStatus)&&/(reviewed|approved|accepted|pass|passed|complete|completed)/i.test(reviewStatus);
    passed=passed&&reviewPassed;
  }
  var updatedAt=eapV146Text_(eapV146Pick_(o,['teacherReviewedAt','updatedAt','latestAt','receivedAt','completedAt','clientTimestamp','occurredAt','createdAt','timestamp']));
  return {
    studentId:requestedStudentId,sourceStudentId:sourceStudentId,
    studentName:eapV146Text_(eapV146Pick_(o,['studentName','name'])),section:section,
    routeId:route,sessionId:route,sessionTitle:eapV146Text_(eapV146Pick_(o,['routeTitle','sessionTitle','missionTitle'])),
    skill:skill,score:score,bestScore:score,latestScore:score,passed:passed,
    authoritativePassed:explicitPassed,updatedAt:updatedAt,latestAt:updatedAt,
    restoredFromSheet:true,cloudVerified:true,serverVerified:true,
    resumeSource:'v146_staged_current_route',sourceSheet:sourceSheet,
    teacherReviewRequired:reviewRequired,teacherReviewStatus:reviewStatus,legacyCompletion:false
  };
}
function eapV146ReadRows_(sh,startRow,numRows,sourceStudentId,section,requestedStudentId,routeFilter){
  var lastCol=sh.getLastColumn(); if(numRows<=0||lastCol<1) return [];
  var headers=sh.getRange(1,1,1,lastCol).getValues()[0];
  var values=sh.getRange(startRow,1,numRows,lastCol).getValues();
  var out=[];
  for(var i=0;i<values.length;i++){
    var direct=eapV146Obj_(headers,values[i]);
    var o=eapV146Merge_(eapV146Nested_(direct),direct);
    var rec=eapV146Normalize_(o,sh.getName(),requestedStudentId,sourceStudentId,section,routeFilter);
    if(rec) out.push(rec);
  }
  return out;
}
function eapV146ReadBase_(ss,sourceStudentId,section,requestedStudentId){
  var all=[],scanned=[],sources=[];
  EAP_SESSION_V146_BASE_SHEETS.forEach(function(name){
    var sh=ss.getSheetByName(name); if(!sh) return;
    scanned.push(name);
    var lastRow=sh.getLastRow(); if(lastRow<2) return;
    var rows=eapV146ReadRows_(sh,2,lastRow-1,sourceStudentId,section,requestedStudentId,'');
    if(rows.length){sources.push(name);all=all.concat(rows);}
  });
  return {rows:eapV146Dedup_(all),scannedSheets:scanned,sourceSheets:sources};
}
function eapV146ReadTailForRoute_(ss,routeId,sourceStudentId,section,requestedStudentId){
  var all=[],scanned=[],sources=[],windows={};
  EAP_SESSION_V146_TAIL_SHEETS.forEach(function(name){
    var sh=ss.getSheetByName(name); if(!sh) return;
    var lastRow=sh.getLastRow(); if(lastRow<2) return;
    var n=Math.min(EAP_SESSION_V146_TAIL_ROWS,lastRow-1);
    var start=Math.max(2,lastRow-n+1);
    scanned.push(name); windows[name]={startRow:start,endRow:lastRow,rowCount:n};
    var rows=eapV146ReadRows_(sh,start,n,sourceStudentId,section,requestedStudentId,routeId);
    if(rows.length){sources.push(name);all=all.concat(rows);}
  });
  return {rows:eapV146Dedup_(all),scannedSheets:scanned,sourceSheets:sources,windows:windows};
}
function eapV146Dedup_(rows){
  var best={};
  (rows||[]).forEach(function(r){
    var key=r.sessionId+'|'+r.skill,cur=best[key];
    if(!cur){best[key]=r;return;}
    if(r.passed===true&&cur.passed!==true){best[key]=r;return;}
    if(r.passed!==true&&cur.passed===true)return;
    var rs=eapV146Num_(r.bestScore||r.score),cs=eapV146Num_(cur.bestScore||cur.score);
    if(rs>cs){best[key]=r;return;} if(rs<cs)return;
    if(String(r.updatedAt||'')>String(cur.updatedAt||'')) best[key]=r;
  });
  return Object.keys(best).map(function(k){return best[k];}).sort(function(a,b){
    var ai=EAP_SESSION_V146_ORDER.indexOf(a.sessionId),bi=EAP_SESSION_V146_ORDER.indexOf(b.sessionId);
    return ai!==bi?ai-bi:String(a.skill).localeCompare(String(b.skill));
  });
}
function eapV146BuildProgress_(records){
  var byKey={};(records||[]).forEach(function(r){byKey[r.sessionId+'|'+r.skill]=r;});
  var routeProgress={},passedRoutes=[],currentRoute='',latestActivity='';
  EAP_SESSION_V146_ORDER.forEach(function(routeId){
    var required=(EAP_SESSION_V146_REQUIRED[routeId]||[]).slice(),skills={},passedCount=0;
    required.forEach(function(skill){
      var r=byKey[routeId+'|'+skill]||null;
      skills[skill]=r||{routeId:routeId,sessionId:routeId,skill:skill,passed:false,score:0,teacherReviewStatus:''};
      if(r&&r.passed===true) passedCount++;
      if(r&&String(r.updatedAt||'')>latestActivity) latestActivity=r.updatedAt;
    });
    var complete=required.length>0&&passedCount===required.length;
    routeProgress[routeId]={routeId:routeId,routeType:/^B/.test(routeId)?'boss_gate':'normal_session',requiredSkills:required,requiredSkillCount:required.length,passedSkillCount:passedCount,skills:skills,completed:complete,passed:complete};
    if(!currentRoute&&complete) passedRoutes.push(routeId); else if(!currentRoute) currentRoute=routeId;
  });
  var courseCompleted=!currentRoute; if(courseCompleted) currentRoute='B5';
  var unlockedRouteList=passedRoutes.slice(); if(unlockedRouteList.indexOf(currentRoute)<0) unlockedRouteList.push(currentRoute);
  var unlockedRoutes={},unlockedSessions={}; unlockedRouteList.forEach(function(r){unlockedRoutes[r]=true;var m=r.match(/^S(\d+)$/);if(m)unlockedSessions[String(Number(m[1]))]=true;});
  return {routeProgress:routeProgress,passedRoutes:passedRoutes,currentRoute:currentRoute,courseCompleted:courseCompleted,unlockedRouteList:unlockedRouteList,unlockedRoutes:unlockedRoutes,unlockedSessions:unlockedSessions,latestActivity:latestActivity};
}
function eapV146RunForSource_(ss,sourceStudentId,section,requestedStudentId){
  var base=eapV146ReadBase_(ss,sourceStudentId,section,requestedStudentId);
  var baseProgress=eapV146BuildProgress_(base.rows);
  var stagedRoute=baseProgress.currentRoute;
  var tail=eapV146ReadTailForRoute_(ss,stagedRoute,sourceStudentId,section,requestedStudentId);
  var records=eapV146Dedup_(base.rows.concat(tail.rows));
  var progress=eapV146BuildProgress_(records);

  /* One forward-stage pass: if current-route evidence completes the route,
     inspect the next route tail once so freshly submitted next-route evidence
     can also be restored without a full scan. */
  var nextTail={rows:[],scannedSheets:[],sourceSheets:[],windows:{}};
  if(progress.currentRoute!==stagedRoute){
    nextTail=eapV146ReadTailForRoute_(ss,progress.currentRoute,sourceStudentId,section,requestedStudentId);
    if(nextTail.rows.length){records=eapV146Dedup_(records.concat(nextTail.rows));progress=eapV146BuildProgress_(records);}
  }
  return {records:records,progress:progress,base:base,tail:tail,nextTail:nextTail,stagedRoute:stagedRoute};
}

function eapPlayerResumeV146_(params){
  params=params||{}; var started=Date.now();
  var studentId=eapV146Text_(params.studentId||params.id||params.playerId);
  var studentName=eapV146Text_(params.studentName||params.name||'');
  var section=eapV146Text_(params.section||'122')||'122';
  if(!studentId) return {ok:false,service:'eap-session-authority',version:EAP_SESSION_AUTHORITY_V146,error:'missing_studentId'};

  var cache=CacheService.getScriptCache(),cacheKey='EAP_V146_RESUME|'+section+'|'+studentId;
  if(String(params.force||'')!=='1'){
    var cached=cache.get(cacheKey); if(cached){try{var p=JSON.parse(cached);p.cacheHit=true;p.elapsedMs=Date.now()-started;return p;}catch(_){}}
  }

  var ss=eapV146Spreadsheet_(),sourceStudentId=studentId,usedLegacyTestAlias=false;
  var run=eapV146RunForSource_(ss,sourceStudentId,section,studentId);
  var alias=EAP_SESSION_V146_LEGACY_TEST_ALIASES[section+'|'+studentId]||'';
  if(!run.records.length&&alias){
    var aliasRun=eapV146RunForSource_(ss,alias,section,studentId);
    if(aliasRun.records.length){run=aliasRun;sourceStudentId=alias;usedLegacyTestAlias=true;}
  }
  if(!studentName&&run.records.length) studentName=run.records[0].studentName||'';
  var pr=run.progress;
  var response={
    ok:true,service:'eap-session-authority',version:EAP_SESSION_AUTHORITY_V146,
    engine:'eapPlayerResumeV146_',authorityMode:'sheet-only-staged-current-route',
    progressPolicy:'normal-required-pairs-boss-four-skills',
    studentId:studentId,requestedStudentId:studentId,sourceStudentId:sourceStudentId,
    usedLegacyTestAlias:usedLegacyTestAlias,studentName:studentName||'Student',section:section,
    stagedRoute:run.stagedRoute,records:run.records,recordCount:run.records.length,
    baseScannedSheets:run.base.scannedSheets,baseSourceSheets:run.base.sourceSheets,
    tailScannedSheets:run.tail.scannedSheets,tailSourceSheets:run.tail.sourceSheets,tailWindows:run.tail.windows,
    nextTailSourceSheets:run.nextTail.sourceSheets||[],
    routeProgress:pr.routeProgress,sessionProgress:pr.routeProgress,
    passedRoutes:pr.passedRoutes,completedRoutes:pr.passedRoutes,
    unlockedRouteList:pr.unlockedRouteList,unlockedRoutes:pr.unlockedRoutes,unlockedSessions:pr.unlockedSessions,
    currentRoute:pr.currentRoute,currentCloudRoute:pr.currentRoute,nextRoute:pr.currentRoute,
    courseCompleted:pr.courseCompleted,requiredSkillsByRoute:EAP_SESSION_V146_REQUIRED,
    latestActivity:pr.latestActivity,generatedAt:new Date().toISOString(),cacheHit:false,elapsedMs:Date.now()-started
  };
  try{cache.put(cacheKey,JSON.stringify(response),EAP_SESSION_V146_CACHE_SEC);}catch(_){}
  return response;
}

function EAP_testPlayerResumeV146(){
  var r=eapPlayerResumeV146_({studentId:'50',section:'122',force:'1'});
  Logger.log(JSON.stringify(r)); return r;
}
