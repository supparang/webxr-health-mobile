/**
 * CSAI2102 AI Quest Teacher Progress Receiver v1.0
 * Multi-student class overview and student detail.
 * Requires AIQuestFlow_Receiver.gs. Does NOT declare doGet/doPost.
 */
var AIQTEACHER = AIQTEACHER || {};
AIQTEACHER.VERSION = '20260722-AIQ-TEACHER-PROGRESS-V1.0.0';
AIQTEACHER.ORDER = ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
AIQTEACHER.text_ = function(v){return String(v==null?'':v).trim();};
AIQTEACHER.bool_ = function(v){return v===true||['true','1','yes','pass','passed','mastered','completed','submitted'].indexOf(AIQTEACHER.text_(v).toLowerCase())>=0;};
AIQTEACHER.profileRows_ = function(section){
  var ss=SpreadsheetApp.getActiveSpreadsheet(), names=['student_profiles','students-profile','profiles','student_profile'], out={}, sh,d,h,iId,iName,iSec;
  for(var n=0;n<names.length;n++){
    sh=ss.getSheetByName(names[n]); if(!sh) continue;
    d=AIQFLOW.rows_(sh); h=d.headers;
    iId=AIQFLOW.headerIndex_(h,['student_id','studentId','id']);
    iName=AIQFLOW.headerIndex_(h,['student_name','studentName','name','full_name']);
    iSec=AIQFLOW.headerIndex_(h,['section','class_section']);
    if(iId<0) continue;
    d.rows.forEach(function(r){
      var sid=AIQTEACHER.text_(r[iId]), sec=iSec>=0?AIQTEACHER.text_(r[iSec]):section;
      if(!sid||sec!==section) return;
      out[sid]={studentId:sid,studentName:iName>=0?AIQTEACHER.text_(r[iName]):'',section:section};
    });
  }
  return out;
};
AIQTEACHER.collectIdsFromSheet_ = function(map,sheetName,section){
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName); if(!sh) return;
  var d=AIQFLOW.rows_(sh),h=d.headers,iId=AIQFLOW.headerIndex_(h,['student_id','studentId']),iName=AIQFLOW.headerIndex_(h,['student_name','studentName','name']),iSec=AIQFLOW.headerIndex_(h,['section','class_section']);
  if(iId<0) return;
  d.rows.forEach(function(r){var sid=AIQTEACHER.text_(r[iId]),sec=iSec>=0?AIQTEACHER.text_(r[iSec]):section;if(!sid||sec!==section)return;if(!map[sid])map[sid]={studentId:sid,studentName:iName>=0?AIQTEACHER.text_(r[iName]):'',section:section};});
};
AIQTEACHER.studentIds_ = function(section){
  var map=AIQTEACHER.profileRows_(section);
  ['session_attempts','attempts','teacher_summary','session_summary','coding_attempts','aiquest_reflections','aiquest_session_completion'].forEach(function(s){AIQTEACHER.collectIdsFromSheet_(map,s,section);});
  return Object.keys(map).sort().map(function(k){return map[k];});
};
AIQTEACHER.detail_ = function(student,section){
  var sessions={},completed=0,missionCount=0,codingCount=0,reflectionCount=0,lastSession='',pendingPart='Mission';
  AIQTEACHER.ORDER.forEach(function(id){
    var m=AIQFLOW.missionStatus_(student.studentId,section,id),c=AIQFLOW.codingStatus_(student.studentId,section,id),r=AIQFLOW.reflectionStatus_(student.studentId,section,id),done=!!(m.completed&&c.completed&&r.completed);
    if(m.completed) missionCount++; if(c.completed) codingCount++; if(r.completed) reflectionCount++; if(done){completed++;lastSession=id;}
    sessions[id]={mission:!!m.completed,missionScore:Number(m.bestScore||0),coding:!!c.completed,codingScore:Number(c.bestScore||0),reflection:!!r.completed,completed:done};
  });
  var next=AIQTEACHER.ORDER[Math.min(completed,AIQTEACHER.ORDER.length-1)]||'B5', row=sessions[next];
  if(completed>=20){pendingPart='Complete';next='B5';}
  else if(row){pendingPart=!row.mission?'Mission':!row.coding?'Coding':!row.reflection?'Reflection':'Complete';}
  var risk='low',reason='On track';
  if(completed===0&&missionCount===0){risk='high';reason='ยังไม่เริ่มเรียน';}
  else if(missionCount-codingCount>=2){risk='high';reason='ค้าง Coding หลายด่าน';}
  else if(codingCount-reflectionCount>=2){risk='medium';reason='ค้าง Reflection หลายด่าน';}
  else if(pendingPart==='Coding'||pendingPart==='Reflection'){risk='medium';reason='ค้าง '+pendingPart+' ที่ '+next;}
  return {studentId:student.studentId,studentName:student.studentName,section:section,completedSessions:completed,totalSessions:20,missionCount:missionCount,codingCount:codingCount,reflectionCount:reflectionCount,lastCompleted:lastSession,nextSession:next,pendingPart:pendingPart,risk:risk,riskReason:reason,sessions:sessions};
};
AIQTEACHER.classOverview_ = function(p){
  var section=AIQTEACHER.text_(p.section||'101'),query=AIQTEACHER.text_(p.query).toLowerCase(),students=AIQTEACHER.studentIds_(section),rows=[];
  students.forEach(function(s){if(query&&s.studentId.toLowerCase().indexOf(query)<0&&s.studentName.toLowerCase().indexOf(query)<0)return;rows.push(AIQTEACHER.detail_(s,section));});
  var high=0,medium=0,complete=0,started=0,totalCompleted=0;
  rows.forEach(function(r){if(r.risk==='high')high++;if(r.risk==='medium')medium++;if(r.completedSessions===20)complete++;if(r.missionCount>0)started++;totalCompleted+=r.completedSessions;});
  return {ok:true,section:section,summary:{studentCount:rows.length,startedCount:started,completeCount:complete,highRiskCount:high,mediumRiskCount:medium,averageCompleted:rows.length?Math.round(totalCompleted*10/rows.length)/10:0},students:rows,version:AIQTEACHER.VERSION};
};
AIQTEACHER.studentDetail_ = function(p){
  var section=AIQTEACHER.text_(p.section||'101'),sid=AIQTEACHER.text_(p.studentId),profiles=AIQTEACHER.studentIds_(section),student=null;
  profiles.some(function(s){if(s.studentId===sid){student=s;return true;}return false;});
  if(!student) student={studentId:sid,studentName:AIQTEACHER.text_(p.studentName),section:section};
  if(!sid)return{ok:false,code:'MISSING_STUDENT_ID',version:AIQTEACHER.VERSION};
  return {ok:true,student:AIQTEACHER.detail_(student,section),version:AIQTEACHER.VERSION};
};
AIQTEACHER.handle = function(p){
  p=p||{};var action=AIQTEACHER.text_(p.action).toUpperCase();
  if(action==='GET_CLASS_OVERVIEW')return AIQTEACHER.classOverview_(p);
  if(action==='GET_STUDENT_DETAIL')return AIQTEACHER.studentDetail_(p);
  return {ok:false,code:'UNKNOWN_TEACHER_ACTION',action:action,version:AIQTEACHER.VERSION};
};