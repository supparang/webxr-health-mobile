/**
 * CSAI2102 AI Quest — Coding Authority Gate v3.2.3
 * Server-side anti-bypass wrapper for official Coding Lab submissions.
 *
 * Authority rule:
 *   previous session fully completed (except S1)
 *   AND current Graded Mission passed
 *   BEFORE SUBMIT_CODING_LAB may reach AIQCODING.handle(...).
 *
 * Uses current + previous session status only; avoids scanning all 20 stages
 * on every Coding submission. This file does not declare doGet/doPost.
 */
var AIQCODING_SECURE = AIQCODING_SECURE || {};

AIQCODING_SECURE.VERSION = '20260813-AIQ-CODING-AUTHORITY-GATE-V3.2.3';
AIQCODING_SECURE.ORDER = ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
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
  var index=AIQCODING_SECURE.ORDER.indexOf(sessionId);

  if(!studentId||!studentName||!section||index<0){
    return {ok:false,code:'MISSING_OR_INVALID_IDENTITY',message:'ต้องมี studentId, studentName, section และ sessionId ที่ถูกต้องก่อนส่ง Coding Lab',version:AIQCODING_SECURE.VERSION};
  }
  if(typeof AIQFLOW==='undefined'||typeof AIQFLOW.getSessionStatus_!=='function'){
    return {ok:false,code:'FLOW_AUTHORITY_MISSING',message:'ไม่พบ AIQFLOW authority จึงปฏิเสธการส่ง Coding Lab แบบ fail-closed',version:AIQCODING_SECURE.VERSION};
  }

  var current=AIQFLOW.getSessionStatus_({studentId:studentId,studentName:studentName,section:section,sessionId:sessionId});
  if(!current||current.ok===false){
    return {ok:false,code:'FLOW_CURRENT_STATUS_FAILED',message:'ตรวจสถานะด่านปัจจุบันจาก Google Sheet ไม่สำเร็จ',flow:current||null,version:AIQCODING_SECURE.VERSION};
  }

  var unlocked=true,previous=null,previousId='';
  if(index>0){
    previousId=AIQCODING_SECURE.ORDER[index-1];
    previous=AIQFLOW.getSessionStatus_({studentId:studentId,studentName:studentName,section:section,sessionId:previousId});
    if(!previous||previous.ok===false){
      return {ok:false,code:'FLOW_PREVIOUS_STATUS_FAILED',message:'ตรวจสถานะด่านก่อนหน้าจาก Google Sheet ไม่สำเร็จ',previousSession:previousId,flow:previous||null,version:AIQCODING_SECURE.VERSION};
    }
    unlocked=previous.completed===true;
  }

  if(!unlocked){
    return {ok:false,code:'SESSION_LOCKED',message:'ด่านนี้ยังไม่ถูกปลดล็อก ต้องจบด่านก่อนหน้าให้ครบ Mission + Coding + Reflection',sessionId:sessionId,previousSession:previousId,authority:'AIQFLOW Google Sheet',version:AIQCODING_SECURE.VERSION};
  }

  var missionPassed=!!(current.mission&&current.mission.completed===true);
  if(!missionPassed){
    return {ok:false,code:'MISSION_NOT_PASSED',message:'ต้องผ่าน Graded Mission ของด่านนี้ก่อนส่ง Coding Lab',sessionId:sessionId,missionScore:current.mission&&current.mission.bestScore!=null?Number(current.mission.bestScore):null,authority:'AIQFLOW Google Sheet',version:AIQCODING_SECURE.VERSION};
  }

  return {
    ok:true,studentId:studentId,studentName:studentName,section:section,sessionId:sessionId,
    unlocked:true,missionPassed:true,
    missionScore:current.mission&&current.mission.bestScore!=null?Number(current.mission.bestScore):null,
    previousSession:previousId,previousCompleted:index===0?true:!!(previous&&previous.completed),
    authority:'AIQFLOW Google Sheet current+previous session',version:AIQCODING_SECURE.VERSION
  };
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
      result.authorityGate={
        passed:true,sessionId:gate.sessionId,previousSession:gate.previousSession,
        missionScore:gate.missionScore,version:AIQCODING_SECURE.VERSION
      };
    }
    return result;
  }

  // Read-only status/config actions remain available; official progression stays server-authoritative.
  return AIQCODING.handle(payload);
};

function AIQCODING_TEST_AUTHORITY_GATE_(payload){
  return AIQCODING_SECURE.authorize_(payload||{});
}
