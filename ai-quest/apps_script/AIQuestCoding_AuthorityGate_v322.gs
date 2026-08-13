/**
 * CSAI2102 AI Quest — Coding Authority Gate v3.2.2
 * Server-side anti-bypass wrapper for official Coding Lab submissions.
 *
 * Authority rule:
 *   session unlocked by previous full completion
 *   AND current Graded Mission passed
 *   BEFORE SUBMIT_CODING_LAB may reach AIQCODING.handle(...).
 *
 * This file does not declare doGet/doPost. The shared router must call
 * AIQCODING_SECURE.handle(payload) for AIQCODING traffic.
 */
var AIQCODING_SECURE = AIQCODING_SECURE || {};

AIQCODING_SECURE.VERSION = '20260813-AIQ-CODING-AUTHORITY-GATE-V3.2.2';
AIQCODING_SECURE.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQCODING_SECURE.session_ = function(v){
  var s=AIQCODING_SECURE.text_(v).toUpperCase().replace(/[\s_:\-]+/g,'');
  var m=s.match(/^(?:MISSION|SESSION|M)?(S?(?:[1-9]|1[0-5])|B[1-5])$/);
  if(!m)return '';
  var x=m[1];
  return /^\d+$/.test(x)?'S'+x:x;
};

AIQCODING_SECURE.authorize_ = function(payload){
  payload=payload||{};
  var studentId=AIQCODING_SECURE.text_(payload.studentId);
  var studentName=AIQCODING_SECURE.text_(payload.studentName);
  var section=AIQCODING_SECURE.text_(payload.section||'101');
  var sessionId=AIQCODING_SECURE.session_(payload.sessionId||payload.session||payload.mission);

  if(!studentId||!studentName||!section||!sessionId){
    return {ok:false,code:'MISSING_IDENTITY',message:'ต้องมี studentId, studentName, section และ sessionId ก่อนส่ง Coding Lab',version:AIQCODING_SECURE.VERSION};
  }
  if(typeof AIQFLOW==='undefined'||typeof AIQFLOW.getProgress_!=='function'){
    return {ok:false,code:'FLOW_AUTHORITY_MISSING',message:'ไม่พบ AIQFLOW authority จึงปฏิเสธการส่ง Coding Lab แบบ fail-closed',version:AIQCODING_SECURE.VERSION};
  }

  var flow=AIQFLOW.getProgress_({studentId:studentId,studentName:studentName,section:section});
  if(!flow||flow.ok===false){
    return {ok:false,code:'FLOW_AUTHORITY_FAILED',message:'ตรวจ progression จาก Google Sheet ไม่สำเร็จ',flow:flow||null,version:AIQCODING_SECURE.VERSION};
  }

  var row=flow.progress&&flow.progress[sessionId.toLowerCase()];
  if(!row){
    return {ok:false,code:'FLOW_SESSION_MISSING',sessionId:sessionId,version:AIQCODING_SECURE.VERSION};
  }
  if(row.unlocked!==true){
    return {ok:false,code:'SESSION_LOCKED',message:'ด่านนี้ยังไม่ถูกปลดล็อกจากการจบด่านก่อนหน้า',sessionId:sessionId,authority:'AIQFLOW Google Sheet',version:AIQCODING_SECURE.VERSION};
  }
  if(row.missionPassed!==true){
    return {ok:false,code:'MISSION_NOT_PASSED',message:'ต้องผ่าน Graded Mission ของด่านนี้ก่อนส่ง Coding Lab',sessionId:sessionId,missionScore:row.missionScore,authority:'AIQFLOW Google Sheet',version:AIQCODING_SECURE.VERSION};
  }

  return {ok:true,studentId:studentId,studentName:studentName,section:section,sessionId:sessionId,unlocked:true,missionPassed:true,missionScore:row.missionScore,authority:'AIQFLOW Google Sheet',version:AIQCODING_SECURE.VERSION};
};

AIQCODING_SECURE.handle = function(payload){
  payload=payload||{};
  var action=AIQCODING_SECURE.text_(payload.action).toUpperCase();

  if(typeof AIQCODING==='undefined'||typeof AIQCODING.handle!=='function'){
    return {ok:false,code:'AIQCODING_MODULE_MISSING',version:AIQCODING_SECURE.VERSION};
  }

  if(action==='SUBMIT_CODING_LAB'){
    var gate=AIQCODING_SECURE.authorize_(payload);
    if(!gate.ok)return gate;
    var result=AIQCODING.handle(payload);
    if(result&&typeof result==='object'){
      result.authorityGate={passed:true,sessionId:gate.sessionId,missionScore:gate.missionScore,version:AIQCODING_SECURE.VERSION};
    }
    return result;
  }

  // Status/config reads remain read-only. Official progression still comes from AIQFLOW.
  return AIQCODING.handle(payload);
};

function AIQCODING_TEST_AUTHORITY_GATE_(payload){
  return AIQCODING_SECURE.authorize_(payload||{});
}
