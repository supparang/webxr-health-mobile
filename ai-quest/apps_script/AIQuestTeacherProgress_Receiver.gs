/**
 * CSAI2102 AI Quest Teacher Progress Receiver v1.2
 * Multi-student class overview + automatic student source discovery.
 * Requires AIQuestFlow_Receiver.gs. Does NOT declare doGet/doPost.
 */
var AIQTEACHER = AIQTEACHER || {};
AIQTEACHER.VERSION = '20260722-AIQ-TEACHER-PROGRESS-V1.2.0-AUTODISCOVERY';
AIQTEACHER.ORDER = ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
AIQTEACHER.text_ = function(v){return String(v==null?'':v).trim();};
AIQTEACHER.norm_ = function(v){return AIQTEACHER.text_(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'');};
AIQTEACHER.sameSection_ = function(value,requested){var a=AIQTEACHER.norm_(value),b=AIQTEACHER.norm_(requested);return !a || !b || a===b;};
AIQTEACHER.headerIndex_ = function(headers,names){
  for(var i=0;i<names.length;i++){
    var target=AIQTEACHER.norm_(names[i]);
    for(var j=0;j<headers.length;j++) if(AIQTEACHER.norm_(headers[j])===target) return j;
  }
  return -1;
};
AIQTEACHER.ID_HEADERS=['student_id','studentId','student id','id','รหัสนักศึกษา','รหัสนิสิต','รหัส'];
AIQTEACHER.NAME_HEADERS=['student_name','studentName','student name','name','full_name','ชื่อ-นามสกุล','ชื่อ นามสกุล','ชื่อนักศึกษา','ชื่อ'];
AIQTEACHER.SECTION_HEADERS=['section','class_section','class','group','room','หมู่เรียน','กลุ่มเรียน','ห้อง','ตอนเรียน'];
AIQTEACHER.dependencyStatus_ = function(){
  var flowReady=typeof AIQFLOW!=='undefined'&&typeof AIQFLOW.rows_==='function'&&typeof AIQFLOW.missionStatus_==='function'&&typeof AIQFLOW.codingStatus_==='function'&&typeof AIQFLOW.reflectionStatus_==='function';
  var ssReady=false,sheetNames=[];
  try{var ss=SpreadsheetApp.getActiveSpreadsheet();ssReady=!!ss;if(ss)sheetNames=ss.getSheets().map(function(s){return s.getName();});}catch(e){}
  return {flowReady:flowReady,spreadsheetReady:ssReady,sheetNames:sheetNames};
};
AIQTEACHER.requireReady_ = function(){var d=AIQTEACHER.dependencyStatus_();if(!d.flowReady)throw new Error('AIQFLOW_DEPENDENCY_MISSING');if(!d.spreadsheetReady)throw new Error('SPREADSHEET_NOT_FOUND');return d;};
AIQTEACHER.scanStudentSources_ = function(section){
  AIQTEACHER.requireReady_();
  var ss=SpreadsheetApp.getActiveSpreadsheet(),map={},diagnostics=[],availableSections={};
  ss.getSheets().forEach(function(sh){
    var d=AIQFLOW.rows_(sh),h=d.headers||[];
    var iId=AIQTEACHER.headerIndex_(h,AIQTEACHER.ID_HEADERS);
    var iName=AIQTEACHER.headerIndex_(h,AIQTEACHER.NAME_HEADERS);
    var iSec=AIQTEACHER.headerIndex_(h,AIQTEACHER.SECTION_HEADERS);
    var info={sheet:sh.getName(),rows:d.rows.length,studentIdColumn:iId>=0?h[iId]:'',studentNameColumn:iName>=0?h[iName]:'',sectionColumn:iSec>=0?h[iSec]:'',accepted:0,rejectedSection:0};
    if(iId<0){diagnostics.push(info);return;}
    d.rows.forEach(function(r){
      var sid=AIQTEACHER.text_(r[iId]);if(!sid)return;
      var sec=iSec>=0?AIQTEACHER.text_(r[iSec]):'';
      if(sec)availableSections[sec]=true;
      if(!AIQTEACHER.sameSection_(sec,section)){info.rejectedSection++;return;}
      var name=iName>=0?AIQTEACHER.text_(r[iName]):'';
      if(!map[sid])map[sid]={studentId:sid,studentName:name,section:sec||section,sourceSheets:[sh.getName()]};
      else{
        if(!map[sid].studentName&&name)map[sid].studentName=name;
        if(map[sid].sourceSheets.indexOf(sh.getName())<0)map[sid].sourceSheets.push(sh.getName());
      }
      info.accepted++;
    });
    diagnostics.push(info);
  });
  return {students:Object.keys(map).sort().map(function(k){return map[k];}),diagnostics:diagnostics,availableSections:Object.keys(availableSections).sort()};
};
AIQTEACHER.detail_ = function(student,section){
  var sessions={},completed=0,missionCount=0,codingCount=0,reflectionCount=0,lastSession='',pendingPart='Mission';
  AIQTEACHER.ORDER.forEach(function(id){
    var m=AIQFLOW.missionStatus_(student.studentId,section,id),c=AIQFLOW.codingStatus_(student.studentId,section,id),r=AIQFLOW.reflectionStatus_(student.studentId,section,id),done=!!(m.completed&&c.completed&&r.completed);
    if(m.completed)missionCount++;if(c.completed)codingCount++;if(r.completed)reflectionCount++;if(done){completed++;lastSession=id;}
    sessions[id]={mission:!!m.completed,missionScore:Number(m.bestScore||0),coding:!!c.completed,codingScore:Number(c.bestScore||0),reflection:!!r.completed,completed:done};
  });
  var next=AIQTEACHER.ORDER[Math.min(completed,AIQTEACHER.ORDER.length-1)]||'B5',row=sessions[next];
  if(completed>=20){pendingPart='Complete';next='B5';}else if(row){pendingPart=!row.mission?'Mission':!row.coding?'Coding':!row.reflection?'Reflection':'Complete';}
  var risk='low',reason='On track';
  if(completed===0&&missionCount===0){risk='high';reason='ยังไม่เริ่มเรียน';}
  else if(missionCount-codingCount>=2){risk='high';reason='ค้าง Coding หลายด่าน';}
  else if(codingCount-reflectionCount>=2){risk='medium';reason='ค้าง Reflection หลายด่าน';}
  else if(pendingPart==='Coding'||pendingPart==='Reflection'){risk='medium';reason='ค้าง '+pendingPart+' ที่ '+next;}
  return {studentId:student.studentId,studentName:student.studentName||'',section:section,sourceSheets:student.sourceSheets||[],completedSessions:completed,totalSessions:20,missionCount:missionCount,codingCount:codingCount,reflectionCount:reflectionCount,lastCompleted:lastSession,nextSession:next,pendingPart:pendingPart,risk:risk,riskReason:reason,sessions:sessions};
};
AIQTEACHER.classOverview_ = function(p){
  AIQTEACHER.requireReady_();
  var section=AIQTEACHER.text_(p.section||'101'),query=AIQTEACHER.text_(p.query).toLowerCase(),scan=AIQTEACHER.scanStudentSources_(section),rows=[];
  scan.students.forEach(function(s){if(query&&s.studentId.toLowerCase().indexOf(query)<0&&s.studentName.toLowerCase().indexOf(query)<0)return;rows.push(AIQTEACHER.detail_(s,section));});
  var high=0,medium=0,complete=0,started=0,totalCompleted=0;
  rows.forEach(function(r){if(r.risk==='high')high++;if(r.risk==='medium')medium++;if(r.completedSessions===20)complete++;if(r.missionCount>0)started++;totalCompleted+=r.completedSessions;});
  return {ok:true,section:section,summary:{studentCount:rows.length,startedCount:started,completeCount:complete,highRiskCount:high,mediumRiskCount:medium,averageCompleted:rows.length?Math.round(totalCompleted*10/rows.length)/10:0},students:rows,diagnostics:{studentSources:scan.diagnostics,availableSections:scan.availableSections,matchedStudents:scan.students.length},version:AIQTEACHER.VERSION};
};
AIQTEACHER.studentDetail_ = function(p){
  AIQTEACHER.requireReady_();
  var section=AIQTEACHER.text_(p.section||'101'),sid=AIQTEACHER.text_(p.studentId),scan=AIQTEACHER.scanStudentSources_(section),student=null;
  scan.students.some(function(s){if(s.studentId===sid){student=s;return true;}return false;});
  if(!student)student={studentId:sid,studentName:AIQTEACHER.text_(p.studentName),section:section,sourceSheets:[]};
  if(!sid)return{ok:false,code:'MISSING_STUDENT_ID',version:AIQTEACHER.VERSION};
  return {ok:true,student:AIQTEACHER.detail_(student,section),version:AIQTEACHER.VERSION};
};
AIQTEACHER.ping_ = function(){var d=AIQTEACHER.dependencyStatus_();return {ok:d.flowReady&&d.spreadsheetReady,code:d.flowReady?(d.spreadsheetReady?'READY':'SPREADSHEET_NOT_FOUND'):'AIQFLOW_DEPENDENCY_MISSING',module:'AIQTEACHER',version:AIQTEACHER.VERSION,dependencies:d};};
AIQTEACHER.handle = function(p){
  try{p=p||{};var action=AIQTEACHER.text_(p.action).toUpperCase();if(action==='PING'||action==='TEACHER_PING')return AIQTEACHER.ping_();if(action==='GET_CLASS_OVERVIEW')return AIQTEACHER.classOverview_(p);if(action==='GET_STUDENT_DETAIL')return AIQTEACHER.studentDetail_(p);return {ok:false,code:'UNKNOWN_TEACHER_ACTION',action:action,version:AIQTEACHER.VERSION};}
  catch(e){return {ok:false,code:String(e&&e.message||e||'TEACHER_SERVER_ERROR'),message:String(e&&e.stack||e||''),version:AIQTEACHER.VERSION};}
};