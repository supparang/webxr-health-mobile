(()=>{
'use strict';
const VERSION='20260729-SHEET-AUTHORITY-HARD-RESET-V3-PROGRESS-FIRST';
const KEY='herohealth_learning_platform_rc2';
const PREFIX='herohealth_student_resume_v6:';
const R=window.HHRotation;
if(!R)return;
const read=(k,f=null)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}};
const id=v=>String(v||'').trim().replace(/\s+/g,'');
function isFalse(v){return v===false||v===0||String(v??'').trim().toLowerCase()==='false'}
function rank(p){return Math.max(Number(p?.completedCount)||0,Math.round((Number(p?.progressPct)||0)/100*(Number(p?.totalSteps)||9)))}
function topProgress(api){
  const authoritative=api?.authoritativeState?.progress||null;
  const top=api?.progress||null;
  const live=api?.live?{progressPct:Number(api.live.progressPct)||0,completedCount:Number(api.live.completedCount)||0,totalSteps:Number(top?.totalSteps||authoritative?.totalSteps)||9,nextStep:api.live.currentStep||'',missionComplete:api.live.missionComplete===true}:null;
  const candidates=[authoritative,top,live].filter(Boolean);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>rank(b)-rank(a));
  return candidates[0];
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
  R.syncZoneCompletion(s);
  if(!R.ZONE_ORDER.every(z=>s.completed[z]===true)){s.completed.posttest=false;s.completed.reflection=false}
  if(!s.completed.posttest)s.completed.reflection=false;
  s.completed.gameSummary=false;
  s.authoritativeProgress={progressPct:Number(progress.progressPct)||Math.round(index/route.length*100),completedCount:Number(progress.completedCount)||index,totalSteps:Number(progress.totalSteps)||route.length,nextStep:route[index]?.id||next||'pretest',missionComplete:false};
  s.sheetAuthority=true;s.offlineAuthority=false;s.legacyVerified=false;s.lastAuthoritySyncAt=new Date().toISOString();s.hardResetVersion=VERSION;
  delete s.legacySource;delete s.legacyCertificateRestored;delete s.legacyCertificateAuthorityVersion;delete s.gameSummaryAuthority;
  return s
}
async function run(){const state=read(KEY,{}),sid=id(state?.profile?.studentId);if(!sid||!window.HHStudentResume?.getStudent)return;try{const api=await window.HHStudentResume.getStudent(sid);const next=rebuildFromNextStep(state,api);if(!next)return;write(KEY,next);write(PREFIX+sid,next);sessionStorage.setItem('hh_authority_bootstrap:'+sid,String(Date.now()));const changed=JSON.stringify(state.completed)!==JSON.stringify(next.completed)||JSON.stringify(state.gameCompleted)!==JSON.stringify(next.gameCompleted)||Number(state?.authoritativeProgress?.progressPct)!==Number(next?.authoritativeProgress?.progressPct);if(changed)location.reload()}catch(err){console.error('[HeroHealth hard reset]',err)}}
addEventListener('DOMContentLoaded',()=>setTimeout(run,700));
window.HHSheetAuthorityHardReset={run,rebuildFromNextStep,topProgress,version:VERSION};
})();