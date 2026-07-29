(()=>{
'use strict';
const VERSION='20260729-RETURN-PROCESSOR-SHEET-AUTHORITY-R4';
const KEY='herohealth_learning_platform_rc2',R=window.HHRotation;
const q=new URLSearchParams(location.search),kind=q.get('hhReturn');
if(!kind||!R)return;
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function clean(){['hhReturn','task','zone','gameId','passed','completed','score','accuracy','eventId','studentId','sessionId','startedAt','sheetSync','form','assessmentVersion','attemptId'].forEach(k=>q.delete(k));const next=location.pathname+(q.toString()?`?${q}`:'')+location.hash;history.replaceState({},'',next)}
const s=load();if(!s||!s.profile){clean();return}
const sid=String(q.get('studentId')||'').trim(),profileSid=String(s.profile.studentId||'').trim();if(sid&&sid!==profileSid){clean();return}
if(kind==='assessment'){
 const task=q.get('task');if(!['pretest','posttest','reflection'].includes(task)){clean();return}
 const score=Number(q.get('score'))||0,sheetSync=String(q.get('sheetSync')||'').toLowerCase(),form=q.get('form')||'',attemptId=q.get('attemptId')||'';
 s.pendingAssessmentAuthority={task,studentId:profileSid,score,form,attemptId,sheetSync,returnedAt:new Date().toISOString(),version:VERSION};
 s.lastLocalAssessmentReturn={task,score,studentId:profileSid,returnedAt:new Date().toISOString(),pendingClassroomSync:true,sheetSync,version:VERSION};
 s.sheetAuthority=false;
 try{sessionStorage.setItem('hh_recent_assessment_return:'+profileSid,String(Date.now()))}catch(_){}
 save(s);
 // The authority bridge owns confirmed/pending assessment returns. Never reload and terminate its request.
 if(window.__HH_ASSESSMENT_BRIDGE_PENDING__===true||['confirmed','sent','pending'].includes(sheetSync))return;
 clean();location.reload();return;
}
if(kind==='game'){
 const zone=q.get('zone'),gameId=q.get('gameId'),finished=q.get('completed')==='true'||q.get('passed')==='true';
 if(finished&&zone&&gameId){s.pendingGameAuthority={studentId:profileSid,zone,gameId,score:Number(q.get('score'))||0,accuracy:Number(q.get('accuracy'))||0,eventId:q.get('eventId')||'',returnedAt:new Date().toISOString(),version:VERSION};s.sheetAuthority=false;save(s)}
 clean();location.reload();
}
})();