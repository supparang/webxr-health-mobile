/**
 * CSAI2102 AI Quest Integrated Flow Receiver v1.0
 * Profile -> Mission -> Coding -> Reflection -> Session completion
 * Direct Google Sheet implementation. No doGet/doPost declarations.
 */
var AIQFLOW = AIQFLOW || {};
AIQFLOW.VERSION = '20260720-AIQ-FLOW-V1.0.0';
AIQFLOW.SECTION = '101';
AIQFLOW.REFLECTION_SHEET = 'aiquest_reflections';
AIQFLOW.COMPLETION_SHEET = 'aiquest_session_completion';

AIQFLOW.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQFLOW.norm_ = function(v){ return AIQFLOW.text_(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,''); };
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
AIQFLOW.findProfile_ = function(studentId,section){
  var ss=AIQFLOW.ss_(), names=['student_profiles','students-profile','profiles','student_profile'];
  for(var n=0;n<names.length;n++){
    var sh=ss.getSheetByName(names[n]); if(!sh) continue;
    var d=AIQFLOW.rows_(sh), h=d.headers;
    var iId=AIQFLOW.headerIndex_(h,['student_id','studentId','id']);
    var iSec=AIQFLOW.headerIndex_(h,['section','class_section']);
    var iName=AIQFLOW.headerIndex_(h,['student_name','studentName','name','full_name']);
    if(iId<0) continue;
    for(var r=d.rows.length-1;r>=0;r--){
      if(AIQFLOW.text_(d.rows[r][iId])===studentId && (iSec<0 || AIQFLOW.text_(d.rows[r][iSec])===section)){
        return {studentId:studentId,studentName:iName>=0?AIQFLOW.text_(d.rows[r][iName]):'',section:section,sourceSheet:names[n]};
      }
    }
  }
  return null;
};
AIQFLOW.lookupProfile_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId), section=AIQFLOW.text_(p.section||AIQFLOW.SECTION);
  if(!studentId) return {ok:false,code:'MISSING_STUDENT_ID',version:AIQFLOW.VERSION};
  var profile=AIQFLOW.findProfile_(studentId,section);
  return {ok:true,found:!!profile,profile:profile,version:AIQFLOW.VERSION};
};
AIQFLOW.codingStatus_ = function(studentId,section,sessionId){
  var sh=AIQFLOW.ss_().getSheetByName('coding_attempts');
  if(!sh) return {found:false,completed:false,bestScore:0};
  var d=AIQFLOW.rows_(sh),h=d.headers;
  var iId=AIQFLOW.headerIndex_(h,['student_id','studentId']);
  var iSec=AIQFLOW.headerIndex_(h,['section','class_section']);
  var iSession=AIQFLOW.headerIndex_(h,['session_id','sessionId','mission_id']);
  var iScore=AIQFLOW.headerIndex_(h,['coding_score','codingScore','score']);
  var best=0,count=0;
  if(iId<0||iSession<0||iScore<0) return {found:false,completed:false,bestScore:0,code:'CODING_HEADER_MISMATCH'};
  d.rows.forEach(function(row){
    if(AIQFLOW.text_(row[iId])===studentId && (iSec<0||AIQFLOW.text_(row[iSec])===section) && AIQFLOW.text_(row[iSession]).toUpperCase()===sessionId){count++;best=Math.max(best,Number(row[iScore]||0));}
  });
  return {found:count>0,completed:best>=60,bestScore:best,attemptCount:count};
};
AIQFLOW.missionStatus_ = function(studentId,section,sessionId){
  var ss=AIQFLOW.ss_(), candidates=['session_attempts','attempts','teacher_summary','session_summary'];
  for(var n=0;n<candidates.length;n++){
    var sh=ss.getSheetByName(candidates[n]); if(!sh) continue;
    var d=AIQFLOW.rows_(sh),h=d.headers;
    var iId=AIQFLOW.headerIndex_(h,['student_id','studentId']);
    var iSec=AIQFLOW.headerIndex_(h,['section','class_section']);
    var iSession=AIQFLOW.headerIndex_(h,['session_id','sessionId','mission_id','missionId']);
    var iScore=AIQFLOW.headerIndex_(h,['score','best_score','bestScore','accuracy']);
    var iPassed=AIQFLOW.headerIndex_(h,['passed','mastered','gate_status','status']);
    if(iId<0||iSession<0) continue;
    var best=0,found=false,passed=false;
    d.rows.forEach(function(row){
      if(AIQFLOW.text_(row[iId])===studentId && (iSec<0||AIQFLOW.text_(row[iSec])===section) && AIQFLOW.text_(row[iSession]).toUpperCase()===sessionId){
        found=true; var score=iScore>=0?Number(row[iScore]||0):0; best=Math.max(best,score);
        var pv=iPassed>=0?AIQFLOW.text_(row[iPassed]).toLowerCase():'';
        if(score>=60 || pv==='true'||pv==='passed'||pv==='pass'||pv==='mastered') passed=true;
      }
    });
    if(found) return {found:true,completed:passed||best>=60,bestScore:best,sourceSheet:candidates[n]};
  }
  return {found:false,completed:false,bestScore:0};
};
AIQFLOW.reflectionStatus_ = function(studentId,section,sessionId){
  var sh=AIQFLOW.ss_().getSheetByName(AIQFLOW.REFLECTION_SHEET); if(!sh) return {found:false,completed:false};
  var d=AIQFLOW.rows_(sh),h=d.headers;
  var iId=AIQFLOW.headerIndex_(h,['student_id']),iSec=AIQFLOW.headerIndex_(h,['section']),iSession=AIQFLOW.headerIndex_(h,['session_id']),iPassed=AIQFLOW.headerIndex_(h,['passed']);
  for(var r=d.rows.length-1;r>=0;r--){var row=d.rows[r];if(AIQFLOW.text_(row[iId])===studentId&&AIQFLOW.text_(row[iSec])===section&&AIQFLOW.text_(row[iSession]).toUpperCase()===sessionId)return {found:true,completed:AIQFLOW.text_(row[iPassed]).toLowerCase()==='true'};}
  return {found:false,completed:false};
};
AIQFLOW.upsertCompletion_ = function(obj){
  var headers=['updated_at','student_id','student_name','section','session_id','mission_completed','mission_score','coding_completed','coding_score','reflection_completed','session_completed','next_session','version'];
  AIQFLOW.appendObject_(AIQFLOW.COMPLETION_SHEET,headers,obj);
};
AIQFLOW.submitReflection_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId),studentName=AIQFLOW.text_(p.studentName),section=AIQFLOW.text_(p.section||AIQFLOW.SECTION),sessionId=AIQFLOW.text_(p.sessionId).toUpperCase();
  var answers=[AIQFLOW.text_(p.reflection1),AIQFLOW.text_(p.reflection2),AIQFLOW.text_(p.reflection3)];
  if(!studentId||!sessionId) return {ok:false,code:'MISSING_IDENTITY',version:AIQFLOW.VERSION};
  if(answers.some(function(x){return x.length<20;})) return {ok:false,code:'REFLECTION_TOO_SHORT',message:'แต่ละคำตอบต้องมีอย่างน้อย 20 ตัวอักษร',version:AIQFLOW.VERSION};
  var coding=AIQFLOW.codingStatus_(studentId,section,sessionId);
  if(!coding.completed) return {ok:false,code:'CODING_NOT_COMPLETED',coding:coding,version:AIQFLOW.VERSION};
  var mission=AIQFLOW.missionStatus_(studentId,section,sessionId);
  if(!mission.completed) return {ok:false,code:'MISSION_NOT_COMPLETED',mission:mission,version:AIQFLOW.VERSION};
  var now=new Date().toISOString();
  AIQFLOW.appendObject_(AIQFLOW.REFLECTION_SHEET,['submitted_at','student_id','student_name','section','session_id','reflection_1','reflection_2','reflection_3','quality_score','passed','version'],{
    submitted_at:now,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,reflection_1:answers[0],reflection_2:answers[1],reflection_3:answers[2],quality_score:100,passed:true,version:AIQFLOW.VERSION
  });
  var order=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  var idx=order.indexOf(sessionId),next=idx>=0&&idx<order.length-1?order[idx+1]:'';
  AIQFLOW.upsertCompletion_({updated_at:now,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,mission_completed:true,mission_score:mission.bestScore||0,coding_completed:true,coding_score:coding.bestScore||0,reflection_completed:true,session_completed:true,next_session:next,version:AIQFLOW.VERSION});
  return {ok:true,completed:true,sessionId:sessionId,nextSession:next,codingScore:coding.bestScore||0,missionScore:mission.bestScore||0,version:AIQFLOW.VERSION};
};
AIQFLOW.getSessionStatus_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId),section=AIQFLOW.text_(p.section||AIQFLOW.SECTION),sessionId=AIQFLOW.text_(p.sessionId).toUpperCase();
  var mission=AIQFLOW.missionStatus_(studentId,section,sessionId),coding=AIQFLOW.codingStatus_(studentId,section,sessionId),reflection=AIQFLOW.reflectionStatus_(studentId,section,sessionId);
  return {ok:true,studentId:studentId,section:section,sessionId:sessionId,mission:mission,coding:coding,reflection:reflection,completed:!!(mission.completed&&coding.completed&&reflection.completed),version:AIQFLOW.VERSION};
};
AIQFLOW.getProgress_ = function(p){
  var studentId=AIQFLOW.text_(p.studentId),section=AIQFLOW.text_(p.section||AIQFLOW.SECTION),sh=AIQFLOW.ss_().getSheetByName(AIQFLOW.COMPLETION_SHEET),progress={};
  if(sh){var d=AIQFLOW.rows_(sh),h=d.headers,iId=AIQFLOW.headerIndex_(h,['student_id']),iSec=AIQFLOW.headerIndex_(h,['section']),iSession=AIQFLOW.headerIndex_(h,['session_id']),iDone=AIQFLOW.headerIndex_(h,['session_completed']),iScore=AIQFLOW.headerIndex_(h,['mission_score']);d.rows.forEach(function(row){if(AIQFLOW.text_(row[iId])===studentId&&AIQFLOW.text_(row[iSec])===section&&AIQFLOW.text_(row[iDone]).toLowerCase()==='true'){var id=AIQFLOW.text_(row[iSession]).toLowerCase();progress[id]={passed:true,score:Number(row[iScore]||100),accuracy:Number(row[iScore]||100)};}});}
  return {ok:true,found:Object.keys(progress).length>0,progress:progress,version:AIQFLOW.VERSION};
};
AIQFLOW.handle = function(p){
  p=p||{};var action=AIQFLOW.text_(p.action).toUpperCase();
  if(action==='LOOKUP_PROFILE') return AIQFLOW.lookupProfile_(p);
  if(action==='SUBMIT_REFLECTION') return AIQFLOW.submitReflection_(p);
  if(action==='GET_SESSION_STATUS') return AIQFLOW.getSessionStatus_(p);
  if(action==='GET_FLOW_PROGRESS') return AIQFLOW.getProgress_(p);
  return {ok:false,code:'UNKNOWN_FLOW_ACTION',action:action,version:AIQFLOW.VERSION};
};
