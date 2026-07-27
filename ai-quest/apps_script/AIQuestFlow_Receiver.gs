/**
 * CSAI2102 AI Quest Integrated Flow Receiver v1.2
 * Profile -> Mission -> Coding -> Reflection -> Session completion
 * Google Sheet is the sole authority. No doGet/doPost declarations.
 */
var AIQFLOW = AIQFLOW || {};
AIQFLOW.VERSION = '20260727-AIQ-FLOW-V1.2.0-STRICT-SESSION-RECONCILE';
AIQFLOW.SECTION = '101';
AIQFLOW.REFLECTION_SHEET = 'aiquest_reflections';
AIQFLOW.COMPLETION_SHEET = 'aiquest_session_completion';
AIQFLOW.ORDER = ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];

AIQFLOW.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQFLOW.norm_ = function(v){ return AIQFLOW.text_(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,''); };
AIQFLOW.idKey_ = function(v){
  var s=AIQFLOW.text_(v);
  if(/^\d+(?:\.0+)?$/.test(s)) return String(parseInt(s,10));
  return s.toLowerCase();
};
AIQFLOW.sectionKey_ = function(v){ return AIQFLOW.idKey_(v); };
AIQFLOW.sessionKey_ = function(v){
  var s=AIQFLOW.text_(v).toUpperCase().replace(/\s+/g,'');
  var m=s.match(/(?:^|[^A-Z0-9])(S(?:1[0-5]|[1-9])|B[1-5])(?:$|[^A-Z0-9])/);
  if(m) return m[1];
  m=s.match(/^(?:SESSION|MISSION|M)?(1[0-5]|[1-9])$/);
  if(m) return 'S'+m[1];
  m=s.match(/^(?:BOSS)?B?([1-5])$/);
  if(/^B/.test(s)&&m) return 'B'+m[1];
  return s;
};
AIQFLOW.bool_ = function(v){
  var s=AIQFLOW.text_(v).toLowerCase();
  return v===true || s==='true'||s==='1'||s==='yes'||s==='passed'||s==='pass'||s==='completed'||s==='mastered';
};
AIQFLOW.num_ = function(v){
  var s=AIQFLOW.text_(v).replace(/,/g,'').replace(/%$/,'');
  if(!s) return 0;
  var n=Number(s);
  return isFinite(n)?n:0;
};
AIQFLOW.ss_ = function(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SPREADSHEET_NOT_FOUND');
  return ss;
};
AIQFLOW.headerIndex_ = function(headers,names){
  for(var i=0;i<names.length;i++){
    var target=AIQFLOW.norm_(names[i]);
    for(var j=0;j<headers.length;j++) if(AIQFLOW.norm_(headers[j])===target) return j;
  }
  return -1;
};
AIQFLOW.rows_ = function(sheet){
  if(!sheet || sheet.getLastRow()<2 || sheet.getLastColumn()<1) return {headers:[],rows:[]};
  var v=sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getDisplayValues();
  return {headers:v[0],rows:v.slice(1)};
};
AIQFLOW.ensureSheet_ = function(name,headers){
  var ss=AIQFLOW.ss_(), sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);
  if(sh.getLastRow()===0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
};
AIQFLOW.appendObject_ = function(name,headers,obj){
  var sh=AIQFLOW.ensureSheet_(name,headers);
  sh.appendRow(headers.map(function(h){ var v=obj[h]; return (v && typeof v==='object') ? JSON.stringify(v) : (v==null?'':v); }));
};
AIQFLOW.sheetCandidates_ = function(names){
  var ss=AIQFLOW.ss_(), out=[];
  (names||[]).forEach(function(name){ var sh=ss.getSheetByName(name); if(sh) out.push(sh); });
  return out;
};
AIQFLOW.sameIdentity_ = function(row,h,studentId,section,sessionId){
  var iId=AIQFLOW.headerIndex_(h,['student_id','studentId','id','student_no','studentNo']);
  var iSec=AIQFLOW.headerIndex_(h,['section','class_section','classSection']);
  var iSession=AIQFLOW.headerIndex_(h,['session_id','sessionId','mission_id','missionId','session','mission']);
  if(iId<0||iSession<0) return false;
  return AIQFLOW.idKey_(row[iId])===AIQFLOW.idKey_(studentId) &&
    (iSec<0||AIQFLOW.sectionKey_(row[iSec])===AIQFLOW.sectionKey_(section)) &&
    AIQFLOW.sessionKey_(row[iSession])===AIQFLOW.sessionKey_(sessionId);
};

AIQFLOW.findProfile_ = function(studentId,section){
  var names=['student_profiles','students-profile','profiles','student_profile'];
  for(var n=0;n<names.length;n++){
    var sh=AIQFLOW.ss_().getSheetByName(names[n]); if(!sh) continue;
    var d=AIQFLOW.rows_(sh),h=d.headers;
    var iId=AIQFLOW.headerIndex_(h,['student_id','studentId','id']);
    var iSec=AIQFLOW.headerIndex_(h,['section','class_section']);
    var iName=AIQFLOW.headerIndex_(h,['student_name','studentName','name','full_name']);
    if(iId<0) continue;
    for(var r=d.rows.length-1;r>=0;r--){
      if(AIQFLOW.idKey_(d.rows[r][iId])===AIQFLOW.idKey_(studentId) && (iSec<0||AIQFLOW.sectionKey_(d.rows[r][iSec])===AIQFLOW.sectionKey_(section))){
        return {studentId:studentId,studentName:iName>=0?AIQFLOW.text_(d.rows[r][iName]):'',section:section,sourceSheet:names[n]};
      }
    }
  }
  return null;
};
AIQFLOW.lookupProfile_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId),section=AIQFLOW.text_(p.section||AIQFLOW.SECTION);
  if(!studentId) return {ok:false,code:'MISSING_STUDENT_ID',version:AIQFLOW.VERSION};
  var profile=AIQFLOW.findProfile_(studentId,section);
  return {ok:true,found:!!profile,profile:profile,version:AIQFLOW.VERSION};
};

AIQFLOW.codingStatus_ = function(studentId,section,sessionId){
  var sheets=AIQFLOW.sheetCandidates_(['coding_attempts','aiquest_coding_attempts','AIQuest_Coding_Attempts','coding_attempt','Coding_Attempts']);
  var best=0,count=0,completed=false,sources=[],matched=[];
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s],d=AIQFLOW.rows_(sh),h=d.headers;
    var iScore=AIQFLOW.headerIndex_(h,['coding_score','codingScore','score','total_score','totalScore']);
    var iDone=AIQFLOW.headerIndex_(h,['completed','passed','coding_completed','codingCompleted','status']);
    for(var r=0;r<d.rows.length;r++){
      var row=d.rows[r];
      if(!AIQFLOW.sameIdentity_(row,h,studentId,section,sessionId)) continue;
      count++;
      var score=iScore>=0?AIQFLOW.num_(row[iScore]):0;
      var done=iDone>=0?AIQFLOW.bool_(row[iDone]):false;
      best=Math.max(best,score);
      if(score>=60||done) completed=true;
      matched.push({sheet:sh.getName(),row:r+2,score:score,done:done});
    }
    if(count>0) sources.push(sh.getName());
  }
  return {found:count>0,completed:completed||best>=60,bestScore:best,attemptCount:count,sourceSheets:sources,matched:matched.slice(-5)};
};
AIQFLOW.missionStatus_ = function(studentId,section,sessionId){
  var sheets=AIQFLOW.sheetCandidates_(['session_attempts','aiquest_session_attempts','mission_attempts','attempts']);
  var best=0,found=false,passed=false,source='',matched=[];
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s],d=AIQFLOW.rows_(sh),h=d.headers;
    var iScore=AIQFLOW.headerIndex_(h,['score','best_score','bestScore','accuracy','percent','percentage']);
    var iPassed=AIQFLOW.headerIndex_(h,['passed','mastered','mission_completed','missionCompleted','gate_status','status','completed']);
    for(var r=0;r<d.rows.length;r++){
      var row=d.rows[r];
      if(!AIQFLOW.sameIdentity_(row,h,studentId,section,sessionId)) continue;
      found=true;source=sh.getName();
      var score=iScore>=0?AIQFLOW.num_(row[iScore]):0;
      var done=iPassed>=0?AIQFLOW.bool_(row[iPassed]):false;
      best=Math.max(best,score);
      if(score>=60||done) passed=true;
      matched.push({sheet:sh.getName(),row:r+2,score:score,done:done});
    }
  }
  return {found:found,completed:passed||best>=60,bestScore:best,sourceSheet:source,matched:matched.slice(-5)};
};
AIQFLOW.reflectionStatus_ = function(studentId,section,sessionId){
  var sheets=AIQFLOW.sheetCandidates_([AIQFLOW.REFLECTION_SHEET,'reflections','aiquest_reflection']);
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s],d=AIQFLOW.rows_(sh),h=d.headers;
    var iPassed=AIQFLOW.headerIndex_(h,['passed','completed','reflection_completed','reflectionCompleted','status']);
    for(var r=d.rows.length-1;r>=0;r--){
      var row=d.rows[r];
      if(!AIQFLOW.sameIdentity_(row,h,studentId,section,sessionId)) continue;
      return {found:true,completed:iPassed<0?true:AIQFLOW.bool_(row[iPassed]),sourceSheet:sh.getName(),row:r+2};
    }
  }
  return {found:false,completed:false};
};

AIQFLOW.upsertCompletion_ = function(obj){
  var headers=['updated_at','student_id','student_name','section','session_id','mission_completed','mission_score','coding_completed','coding_score','reflection_completed','session_completed','next_session','version'];
  AIQFLOW.appendObject_(AIQFLOW.COMPLETION_SHEET,headers,obj);
};
AIQFLOW.submitReflection_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId),studentName=AIQFLOW.text_(p.studentName),section=AIQFLOW.text_(p.section||AIQFLOW.SECTION),sessionId=AIQFLOW.sessionKey_(p.sessionId);
  var answers=[AIQFLOW.text_(p.reflection1),AIQFLOW.text_(p.reflection2),AIQFLOW.text_(p.reflection3)];
  if(!studentId||!sessionId) return {ok:false,code:'MISSING_IDENTITY',version:AIQFLOW.VERSION};
  if(answers.some(function(x){return x.length<20;})) return {ok:false,code:'REFLECTION_TOO_SHORT',message:'แต่ละคำตอบต้องมีอย่างน้อย 20 ตัวอักษร',version:AIQFLOW.VERSION};
  var coding=AIQFLOW.codingStatus_(studentId,section,sessionId);
  if(!coding.completed) return {ok:false,code:'CODING_NOT_COMPLETED',coding:coding,version:AIQFLOW.VERSION};
  var mission=AIQFLOW.missionStatus_(studentId,section,sessionId);
  if(!mission.completed) return {ok:false,code:'MISSION_NOT_COMPLETED',mission:mission,version:AIQFLOW.VERSION};
  var now=new Date().toISOString();
  AIQFLOW.appendObject_(AIQFLOW.REFLECTION_SHEET,['submitted_at','student_id','student_name','section','session_id','reflection_1','reflection_2','reflection_3','quality_score','passed','version'],{submitted_at:now,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,reflection_1:answers[0],reflection_2:answers[1],reflection_3:answers[2],quality_score:100,passed:true,version:AIQFLOW.VERSION});
  var idx=AIQFLOW.ORDER.indexOf(sessionId),next=idx>=0&&idx<AIQFLOW.ORDER.length-1?AIQFLOW.ORDER[idx+1]:'';
  AIQFLOW.upsertCompletion_({updated_at:now,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,mission_completed:true,mission_score:mission.bestScore||0,coding_completed:true,coding_score:coding.bestScore||0,reflection_completed:true,session_completed:true,next_session:next,version:AIQFLOW.VERSION});
  return {ok:true,completed:true,sessionId:sessionId,nextSession:next,codingScore:coding.bestScore||0,missionScore:mission.bestScore||0,version:AIQFLOW.VERSION};
};
AIQFLOW.getSessionStatus_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId),section=AIQFLOW.text_(p.section||AIQFLOW.SECTION),sessionId=AIQFLOW.sessionKey_(p.sessionId);
  var mission=AIQFLOW.missionStatus_(studentId,section,sessionId),coding=AIQFLOW.codingStatus_(studentId,section,sessionId),reflection=AIQFLOW.reflectionStatus_(studentId,section,sessionId);
  return {ok:true,studentId:studentId,section:section,sessionId:sessionId,mission:mission,coding:coding,reflection:reflection,completed:!!(mission.completed&&coding.completed&&reflection.completed),version:AIQFLOW.VERSION};
};
AIQFLOW.getProgress_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId),section=AIQFLOW.text_(p.section||AIQFLOW.SECTION),progress={};
  AIQFLOW.ORDER.forEach(function(sessionId,index){
    var mission=AIQFLOW.missionStatus_(studentId,section,sessionId),coding=AIQFLOW.codingStatus_(studentId,section,sessionId),reflection=AIQFLOW.reflectionStatus_(studentId,section,sessionId),completed=!!(mission.completed&&coding.completed&&reflection.completed);
    progress[sessionId.toLowerCase()]={sessionId:sessionId,mission:mission,coding:coding,reflection:reflection,missionPassed:!!mission.completed,missionScore:mission.found?Number(mission.bestScore||0):null,codingPassed:!!coding.completed,codingScore:coding.found?Number(coding.bestScore||0):null,reflectionSubmitted:!!reflection.completed,completed:completed,unlocked:index===0};
  });
  for(var i=1;i<AIQFLOW.ORDER.length;i++){var current=AIQFLOW.ORDER[i].toLowerCase(),previous=AIQFLOW.ORDER[i-1].toLowerCase();progress[current].unlocked=!!progress[previous].completed;}
  var found=AIQFLOW.ORDER.some(function(id){var row=progress[id.toLowerCase()];return row.mission.found||row.coding.found||row.reflection.found;});
  return {ok:true,found:found,studentId:studentId,section:section,progress:progress,source:'strict-live-three-part',version:AIQFLOW.VERSION};
};
AIQFLOW.handle = function(p){
  p=p||{};var action=AIQFLOW.text_(p.action).toUpperCase();
  if(action==='LOOKUP_PROFILE') return AIQFLOW.lookupProfile_(p);
  if(action==='SUBMIT_REFLECTION') return AIQFLOW.submitReflection_(p);
  if(action==='GET_SESSION_STATUS') return AIQFLOW.getSessionStatus_(p);
  if(action==='GET_FLOW_PROGRESS') return AIQFLOW.getProgress_(p);
  return {ok:false,code:'UNKNOWN_FLOW_ACTION',action:action,version:AIQFLOW.VERSION};
};