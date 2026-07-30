(()=>{
'use strict';
const VERSION='20260730-SHEET-AUTHORITY-HARD-RESET-V6-ROBUST-ASSESSMENT-EVIDENCE';
const KEY='herohealth_learning_platform_rc2';
const PREFIX='herohealth_student_resume_v6:';
const R=window.HHRotation;
if(!R)return;
const read=(k,f=null)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}};
const id=v=>String(v||'').trim().replace(/\s+/g,'');
function isFalse(v){return v===false||v===0||String(v??'').trim().toLowerCase()==='false'}
function rank(p){return Math.max(Number(p?.completedCount)||0,Math.round((Number(p?.progressPct)||0)/100*(Number(p?.totalSteps)||9)))}
function finiteScore(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))}
function localAssessmentEvidence(sid,type){
  const sessionKey=type==='pretest'?'HH_PRETEST_LAST':'HH_POSTTEST_LAST';
  try{const v=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(v&&id(v.studentId)===sid)return true}catch(_){}
  const mode=type==='pretest'?'pre':'post';
  for(const prefix of ['HH_ASSESSMENT_LAST_V3:','HH_ASSESSMENT_LAST_V2:']){
    const v=read(prefix+sid+':'+mode,null);if(v&&id(v.studentId)===sid)return true;
  }
  const legacy=read((type==='pretest'?'HH_PRETEST_LAST_':'HH_POSTTEST_LAST_')+sid,null);
  return !!(legacy&&id(legacy.studentId)===sid)
}
function numericEvidence(...values){return Math.max(0,...values.map(v=>Number(v)||0))}
function assessmentEvidenceCount(api,a){
  const arrays=[api?.assessments,api?.assessmentRows,api?.assessmentHistory,api?.evidence?.assessmentRows,a?.assessments,a?.assessmentRows,a?.assessmentHistory,a?.evidence?.assessmentRows];
  const arrayCount=Math.max(0,...arrays.map(v=>Array.isArray(v)?v.length:0));
  return Math.max(arrayCount,numericEvidence(
    api?.evidence?.assessments,api?.evidence?.assessmentCount,api?.evidence?.assessmentsCount,api?.evidence?.assessmentRows,
    api?.counts?.assessments,api?.counts?.assessmentRows,api?.assessmentCount,api?.assessmentsCount,
    a?.evidence?.assessments,a?.evidence?.assessmentCount,a?.evidence?.assessmentsCount,a?.evidence?.assessmentRows,
    a?.counts?.assessments,a?.counts?.assessmentRows,a?.assessmentCount,a?.assessmentsCount
  ))
}
function assessmentEvidence(api,base,type){
  const sid=id(base?.profile?.studentId||api?.studentId||api?.profile?.studentId);
  const a=api?.authoritativeState||{};
  const completed=a.completed||api?.completed||{};
  const scores=a.scores||api?.scores||{};
  const assessmentRows=assessmentEvidenceCount(api,a);
  if(completed[type]===true)return true;
  if(finiteScore(scores[type]))return true;
  if(type==='pretest'&&assessmentRows>0)return true;
  if(base?.completed?.[type]===true&&base?.sheetAuthority===true)return true;
  if(finiteScore(base?.scores?.[type])&&base?.sheetAuthority===true)return true;
  if(localAssessmentEvidence(sid,type))return true;
  return false
}
function topProgress(api){
  const authoritative=api?.authoritativeState?.progress||null;
  const top=api?.progress||null;
  const live=api?.live?{progressPct:Number(api.live.progressPct)||0,completedCount:Number(api.live.completedCount)||0,totalSteps:Number(top?.totalSteps||authoritative?.totalSteps)||9,nextStep:api.live.currentStep||'',missionComplete:api.live.missionComplete===true}:null;
  const candidates=[authoritative,top,live].filter(Boolean);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>rank(b)-rank(a));
  return candidates[0]
}
function rebuildFromNextStep(base,api){
  const progress=topProgress(api);if(!progress||!isFalse(progress.missionComplete))return null;
  const s={...base};
  s.profile={...(base.profile||{}),...(api.profile||{}),studentId:id(base?.profile?.studentId||api.studentId)};
  s.group=s.profile.group||api.live?.group||base.group||'A';
  const officialCompleted=api?.authoritativeState?.completed||api?.completed||{};
  const officialGames=api?.authoritativeState?.gameCompleted||api?.gameCompleted||{};
  s.completed={pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false,gameSummary:false,...officialCompleted};
  s.gameCompleted={hygiene:{handwash:false,toothbrush:false,...(officialGames.hygiene||{})},nutrition:{groups:false,goodjunk:false,...(officialGames.nutrition||{})},fitness:{jumpduck:false,'balance-hold':false,...(officialGames.fitness||{})}};
  const route=R.routeFor(s);let next=id(progress.nextStep||'pretest').toLowerCase();let index=route.findIndex(step=>id(step.id).toLowerCase()===next);
  if(index<0){const count=Math.max(0,Math.min(route.length,Number(progress.completedCount)||0));index=count}
  for(let i=0;i<index;i++){const step=route[i];if(step.type==='game')s.gameCompleted[step.zoneId][step.gameId]=true;else s.completed[step.id]=true}
  if(assessmentEvidence(api,base,'pretest'))s.completed.pretest=true;
  if(assessmentEvidence(api,base,'posttest'))s.completed.posttest=true;
  const officialScores=api?.authoritativeState?.scores||api?.scores||{};
  s.scores={...(base.scores||{}),...officialScores};
  R.syncZoneCompletion(s);
  if(!R.ZONE_ORDER.every(z=>s.completed[z]===true)){
    if(!assessmentEvidence(api,base,'posttest'))s.completed.posttest=false;
    s.completed.reflection=false
  }
  if(!s.completed.posttest)s.completed.reflection=false;
  s.completed.gameSummary=false;
  let effectiveIndex=index;
  if(s.completed.pretest&&effectiveIndex<1)effectiveIndex=1;
  const effectiveNext=route[effectiveIndex]?.id||(s.completed.pretest?'hygiene:handwash':next||'pretest');
  s.authoritativeProgress={progressPct:Math.max(Number(progress.progressPct)||0,Math.round(effectiveIndex/route.length*100)),completedCount:Math.max(Number(progress.completedCount)||0,effectiveIndex),totalSteps:Number(progress.totalSteps)||route.length,nextStep:effectiveNext,missionComplete:false};
  s.assessmentEvidenceCount=assessmentEvidenceCount(api,api?.authoritativeState||{});
  s.sheetAuthority=true;s.offlineAuthority=false;s.legacyVerified=false;s.lastAuthoritySyncAt=new Date().toISOString();s.hardResetVersion=VERSION;
  delete s.legacySource;delete s.legacyCertificateRestored;delete s.legacyCertificateAuthorityVersion;delete s.gameSummaryAuthority;
  return s
}
async function run(){const state=read(KEY,{}),sid=id(state?.profile?.studentId);if(!sid||!window.HHStudentResume?.getStudent)return;try{const api=await window.HHStudentResume.getStudent(sid);const next=rebuildFromNextStep(state,api);if(!next)return;write(KEY,next);write(PREFIX+sid,next);sessionStorage.setItem('hh_authority_bootstrap:'+sid,String(Date.now()));const changed=JSON.stringify(state.completed)!==JSON.stringify(next.completed)||JSON.stringify(state.gameCompleted)!==JSON.stringify(next.gameCompleted)||Number(state?.authoritativeProgress?.progressPct)!==Number(next?.authoritativeProgress?.progressPct);if(changed)location.reload()}catch(err){console.error('[HeroHealth hard reset]',err)}}
addEventListener('DOMContentLoaded',()=>setTimeout(run,700));
window.HHSheetAuthorityHardReset={run,rebuildFromNextStep,topProgress,assessmentEvidence,assessmentEvidenceCount,version:VERSION};
})();