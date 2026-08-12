/* =========================================================
   EAP Session Authority v145
   BULK CANONICAL EVIDENCE UNION + TWO-SKILL SESSION PROGRESSION
   VERSION: 20260812-EAP-SESSION-AUTHORITY-V145-BULK-EVIDENCE-UNION

   PURPOSE
   - Google Sheet remains the sole authority.
   - Read canonical evidence sources with ONE bulk read per sheet.
   - Avoid TextFinder + per-row getRange request storms.
   - Preserve best/passed evidence per Route + Skill.
   - Normal S1-S15 use required-skill pairs; Boss B1-B5 use four skills.
   - S5 = Reading + Speaking.
   - No doGet()/doPost() in this file.
========================================================= */

var EAP_SESSION_AUTHORITY_V138 =
  '20260812-EAP-SESSION-AUTHORITY-V145-BULK-EVIDENCE-UNION';

var EAP_SESSION_V138_CACHE_SEC = 15;

var EAP_SESSION_V145_SHEETS = [
  'EAP_Summary','summary','EAP_Attempts',
  'attempts','EAP_Evidence','evidence',
  'events','eap-v132-events','eap-v132-quality-audit'
];

var EAP_SESSION_V138_LEGACY_TEST_ALIASES = {
  '122|50': '6811000000'
};

var EAP_SESSION_V138_ORDER = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];

var EAP_SESSION_V138_REQUIRED = {
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

function eapV145Text_(v){
  return String(v == null ? '' : v).replace(/\s+/g,' ').trim();
}
function eapV145Num_(v){
  var n = Number(v); return isFinite(n) ? n : 0;
}
function eapV145Bool_(v){
  return v === true || String(v).toLowerCase() === 'true' ||
    String(v) === '1' || String(v).toLowerCase() === 'yes';
}
function eapV145Route_(v){
  var raw = eapV145Text_(v).toUpperCase(), m;
  if(/^\d+$/.test(raw)) return 'S' + Number(raw);
  m = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
  if(m) return 'S' + Number(m[1]);
  m = raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);
  if(m) return 'B' + Number(m[1]);
  return raw;
}
function eapV145Skill_(v){
  var raw = eapV145Text_(v).toLowerCase().replace(/[^a-z]/g,'');
  if(raw === 'reading' || raw === 'read') return 'Reading';
  if(raw === 'listening' || raw === 'listen') return 'Listening';
  if(raw === 'writing' || raw === 'write') return 'Writing';
  if(raw === 'speaking' || raw === 'speak') return 'Speaking';
  return '';
}
function eapV145Spreadsheet_(){
  if(typeof eapSessionSpreadsheetV137_ === 'function') return eapSessionSpreadsheetV137_();
  if(typeof eapSheetV132Spreadsheet_ === 'function') return eapSheetV132Spreadsheet_();
  if(typeof ss_ === 'function') return ss_();
  var id = '';
  try{id = PropertiesService.getScriptProperties().getProperty('EAP_SPREADSHEET_ID') || '';}catch(_){}
  if(!id) throw new Error('EAP_SPREADSHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}
function eapV145HeaderKey_(v){
  return eapV145Text_(v).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function eapV145Object_(headers,row){
  var o = {};
  (headers || []).forEach(function(h,i){
    var k = eapV145Text_(h);
    if(k) o[k] = row[i];
  });
  return o;
}
function eapV145ParseJson_(v){
  try{
    var o = JSON.parse(String(v || '{}'));
    return o && typeof o === 'object' ? o : {};
  }catch(_){return {};}
}
function eapV145Merge_(nested,direct){
  var o = {};
  Object.keys(nested || {}).forEach(function(k){o[k] = nested[k];});
  Object.keys(direct || {}).forEach(function(k){
    var v = direct[k];
    if(v !== '' && v !== null && v !== undefined) o[k] = v;
  });
  return o;
}
function eapV145Pick_(o,names){
  for(var i=0;i<names.length;i++){
    var target = eapV145HeaderKey_(names[i]);
    var keys = Object.keys(o || {});
    for(var j=0;j<keys.length;j++){
      if(eapV145HeaderKey_(keys[j]) === target){
        var v = o[keys[j]];
        if(v !== '' && v !== null && v !== undefined) return v;
      }
    }
  }
  return '';
}
function eapV145NestedPayload_(direct){
  var raw = eapV145Pick_(direct,[
    'valueJson','rawJson','payloadJson','evidenceJson','payload','dataJson','json'
  ]);
  var nested = eapV145ParseJson_(raw);
  if(nested && nested.payload && typeof nested.payload === 'object'){
    nested = eapV145Merge_(nested.payload,nested);
  }
  if(nested && nested.data && typeof nested.data === 'object'){
    nested = eapV145Merge_(nested.data,nested);
  }
  return nested;
}

function eapV145Normalize_(o,sourceSheet,requestedStudentId,sourceStudentId,section){
  var sid = eapV145Text_(eapV145Pick_(o,['studentId','student_id','playerId','id']));
  if(sid !== sourceStudentId) return null;

  var sec = eapV145Text_(eapV145Pick_(o,['section','classGroup','class','group'])) || section;
  if(sec !== section) return null;

  var route = eapV145Route_(eapV145Pick_(o,['routeId','sessionId','session','missionId','stage','weekId']));
  var skill = eapV145Skill_(eapV145Pick_(o,['skill','skillName','skillKey','focusSkill']));
  if(EAP_SESSION_V138_ORDER.indexOf(route) < 0 || !skill) return null;

  var score = eapV145Num_(eapV145Pick_(o,['bestScore','latestScore','score','teacherScore','missionScore','autoScore']));
  var explicitPassed = eapV145Bool_(eapV145Pick_(o,['passed','pass','mastered','verifiedPassed','authoritativePassed']));
  var passed = explicitPassed || score >= 60;

  var reviewStatus = eapV145Text_(eapV145Pick_(o,['teacherReviewStatus','reviewStatus'])).toLowerCase();
  var reviewRequired = /^B[1-5]$/.test(route) && skill === 'Speaking';
  if(reviewRequired && !explicitPassed){
    var reviewPassed = !!reviewStatus &&
      !/(pending|revise|revision|rework|needs[_ -]?work|not[_ -]?reviewed)/i.test(reviewStatus) &&
      /(reviewed|approved|accepted|pass|passed|complete|completed)/i.test(reviewStatus);
    passed = passed && reviewPassed;
  }

  var updatedAt = eapV145Text_(eapV145Pick_(o,[
    'teacherReviewedAt','updatedAt','latestAt','receivedAt','completedAt',
    'clientTimestamp','occurredAt','createdAt','timestamp'
  ]));

  return {
    studentId:requestedStudentId,
    sourceStudentId:sourceStudentId,
    studentName:eapV145Text_(eapV145Pick_(o,['studentName','name'])),
    section:section,
    routeId:route,
    sessionId:route,
    sessionTitle:eapV145Text_(eapV145Pick_(o,['routeTitle','sessionTitle','missionTitle'])),
    skill:skill,
    score:score,
    bestScore:score,
    latestScore:score,
    passed:passed,
    authoritativePassed:explicitPassed,
    updatedAt:updatedAt,
    latestAt:updatedAt,
    restoredFromSheet:true,
    cloudVerified:true,
    serverVerified:true,
    resumeSource:'bulk_canonical_evidence_union',
    sourceSheet:sourceSheet,
    teacherReviewRequired:reviewRequired,
    teacherReviewStatus:reviewStatus,
    legacyCompletion:false
  };
}

function eapV145ReadSheetBulk_(sh,sourceStudentId,section,requestedStudentId){
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if(lastRow < 2 || lastCol < 1) return [];

  var values = sh.getRange(1,1,lastRow,lastCol).getValues();
  var headers = values[0];
  var out = [];

  for(var i=1;i<values.length;i++){
    var direct = eapV145Object_(headers,values[i]);
    var nested = eapV145NestedPayload_(direct);
    var o = eapV145Merge_(nested,direct);

    var sid = eapV145Text_(eapV145Pick_(o,['studentId','student_id','playerId','id']));
    if(sid !== sourceStudentId) continue;

    var rec = eapV145Normalize_(o,sh.getName(),requestedStudentId,sourceStudentId,section);
    if(rec) out.push(rec);
  }
  return out;
}

function eapV145Dedup_(rows){
  var best = {};
  (rows || []).forEach(function(r){
    var route = eapV145Route_(r.routeId || r.sessionId);
    var skill = eapV145Skill_(r.skill);
    if(EAP_SESSION_V138_ORDER.indexOf(route) < 0 || !skill) return;
    r.routeId = route; r.sessionId = route; r.skill = skill;
    var key = route + '|' + skill;
    var cur = best[key];
    if(!cur){best[key] = r; return;}
    if(r.passed === true && cur.passed !== true){best[key] = r; return;}
    if(r.passed !== true && cur.passed === true) return;
    var s = eapV145Num_(r.bestScore || r.score), cs = eapV145Num_(cur.bestScore || cur.score);
    if(s > cs){best[key] = r; return;}
    if(s < cs) return;
    if(String(r.updatedAt || '') > String(cur.updatedAt || '')) best[key] = r;
  });
  return Object.keys(best).map(function(k){return best[k];}).sort(function(a,b){
    var ar = EAP_SESSION_V138_ORDER.indexOf(a.sessionId), br = EAP_SESSION_V138_ORDER.indexOf(b.sessionId);
    if(ar !== br) return ar - br;
    return String(a.skill).localeCompare(String(b.skill));
  });
}

function eapV145ReadCanonical_(sourceStudentId,section,requestedStudentId){
  var ss = eapV145Spreadsheet_(), all = [], scanned = [], sources = [];
  EAP_SESSION_V145_SHEETS.forEach(function(name){
    var sh = ss.getSheetByName(name);
    if(!sh) return;
    scanned.push(name);
    var rows = eapV145ReadSheetBulk_(sh,sourceStudentId,section,requestedStudentId);
    if(rows.length){sources.push(name); all = all.concat(rows);}
  });
  var merged = eapV145Dedup_(all);
  merged._scannedSheets = scanned;
  merged._sourceSheets = sources;
  return merged;
}

function eapV145BuildProgress_(records){
  var byKey = {};
  (records || []).forEach(function(r){byKey[r.sessionId + '|' + r.skill] = r;});
  var routeProgress = {}, passedRoutes = [], currentRoute = '', latestActivity = '';

  EAP_SESSION_V138_ORDER.forEach(function(routeId){
    var required = (EAP_SESSION_V138_REQUIRED[routeId] || []).slice();
    var skills = {}, passedCount = 0;
    required.forEach(function(skill){
      var r = byKey[routeId + '|' + skill] || null;
      skills[skill] = r || {routeId:routeId,sessionId:routeId,skill:skill,passed:false,score:0,teacherReviewStatus:''};
      if(r && r.passed === true) passedCount++;
      if(r && String(r.updatedAt || '') > latestActivity) latestActivity = r.updatedAt;
    });
    var complete = required.length > 0 && passedCount === required.length;
    routeProgress[routeId] = {
      routeId:routeId,
      routeType:/^B/.test(routeId) ? 'boss_gate' : 'normal_session',
      requiredSkills:required,
      requiredSkillCount:required.length,
      passedSkillCount:passedCount,
      skills:skills,
      completed:complete,
      passed:complete
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
    routeProgress:routeProgress,
    passedRoutes:passedRoutes,
    currentRoute:currentRoute,
    courseCompleted:courseCompleted,
    unlockedRouteList:unlockedRouteList,
    unlockedRoutes:unlockedRoutes,
    unlockedSessions:unlockedSessions,
    latestActivity:latestActivity
  };
}

function eapPlayerResumeV138_(params){
  params = params || {};
  var started = Date.now();
  var studentId = eapV145Text_(params.studentId || params.id || params.playerId);
  var studentName = eapV145Text_(params.studentName || params.name || '');
  var section = eapV145Text_(params.section || '122') || '122';

  if(!studentId) return {ok:false,service:'eap-session-authority',version:EAP_SESSION_AUTHORITY_V138,error:'missing_studentId'};

  var cache = CacheService.getScriptCache();
  var cacheKey = 'EAP_V145_RESUME|' + section + '|' + studentId;
  if(String(params.force || '') !== '1'){
    var cached = cache.get(cacheKey);
    if(cached){
      try{
        var parsed = JSON.parse(cached);
        parsed.cacheHit = true;
        parsed.elapsedMs = Date.now() - started;
        return parsed;
      }catch(_){}
    }
  }

  var sourceStudentId = studentId;
  var records = eapV145ReadCanonical_(studentId,section,studentId);
  var usedLegacyTestAlias = false;
  var aliasKey = section + '|' + studentId;
  var legacySource = EAP_SESSION_V138_LEGACY_TEST_ALIASES[aliasKey] || '';

  if(!records.length && legacySource){
    records = eapV145ReadCanonical_(legacySource,section,studentId);
    if(records.length){sourceStudentId = legacySource; usedLegacyTestAlias = true;}
  }

  var scannedSheets = (records._scannedSheets || []).slice();
  var sourceSheets = (records._sourceSheets || []).slice();
  var progress = eapV145BuildProgress_(records);
  if(!studentName && records.length) studentName = records[0].studentName || '';

  var response = {
    ok:true,
    service:'eap-session-authority',
    version:EAP_SESSION_AUTHORITY_V138,
    authorityMode:'sheet-only-bulk-canonical-evidence-union',
    progressPolicy:'normal-required-pairs-boss-four-skills',
    studentId:studentId,
    requestedStudentId:studentId,
    sourceStudentId:sourceStudentId,
    usedLegacyTestAlias:usedLegacyTestAlias,
    studentName:studentName || 'Student',
    section:section,
    records:records,
    recordCount:records.length,
    scannedSheets:scannedSheets,
    sourceSheets:sourceSheets,
    routeProgress:progress.routeProgress,
    sessionProgress:progress.routeProgress,
    passedRoutes:progress.passedRoutes,
    completedRoutes:progress.passedRoutes,
    unlockedRouteList:progress.unlockedRouteList,
    unlockedRoutes:progress.unlockedRoutes,
    unlockedSessions:progress.unlockedSessions,
    currentRoute:progress.currentRoute,
    currentCloudRoute:progress.currentRoute,
    nextRoute:progress.currentRoute,
    courseCompleted:progress.courseCompleted,
    requiredSkillsByRoute:EAP_SESSION_V138_REQUIRED,
    latestActivity:progress.latestActivity,
    generatedAt:new Date().toISOString(),
    cacheHit:false,
    elapsedMs:Date.now() - started
  };

  try{cache.put(cacheKey,JSON.stringify(response),EAP_SESSION_V138_CACHE_SEC);}catch(_){}
  return response;
}

function EAP_testPlayerResumeV138(){
  var result = eapPlayerResumeV138_({studentId:'50',section:'122',force:'1'});
  Logger.log(JSON.stringify(result));
  return result;
}
