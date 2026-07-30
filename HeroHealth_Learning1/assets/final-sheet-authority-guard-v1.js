(()=>{
'use strict';
const VERSION='20260730-FINAL-SHEET-AUTHORITY-GUARD-V2-PRETEST-UNLOCK';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
const PREFIX='herohealth_student_resume_v6:';
const ENDPOINT='https://script.google.com/macros/s/AKfycbxU82Rg4KFStuZToOGlyX-rgzVkLpZ7yO1tW-gzui782eR7akes_HNZ5ec2TDUDh8J1/exec';
const norm=v=>String(v==null?'':v).trim().replace(/\s+/g,'');
const read=(k,f=null)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}};
function jsonp(params,timeout=30000){return new Promise((resolve,reject)=>{const cb='HHFINAL_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);try{s.remove()}catch(_){}try{delete window[cb]}catch(_){}err?reject(err):resolve(data)};const timer=setTimeout(()=>finish(new Error('authority_timeout')),timeout);window[cb]=data=>finish(null,data);s.onerror=()=>finish(new Error('authority_load_failed'));s.src=ENDPOINT+'?'+new URLSearchParams({...params,callback:cb,_:Date.now()}).toString();(document.head||document.documentElement).appendChild(s)})}
function firstGameStep(group){const rotation=(window.HH_CONFIG&&window.HH_CONFIG.rotation)||{};const profile=(window.HH_CONFIG&&window.HH_CONFIG.missionProfiles&&window.HH_CONFIG.missionProfiles.CLASS_60)||null;const order=rotation[group]||rotation.A||['hygiene','nutrition','fitness'];const zone=order[0]||'hygiene';const game=profile&&profile.games&&profile.games[zone]&&profile.games[zone][0]||({hygiene:'handwash',nutrition:'groups',fitness:'jumpduck'}[zone]||'handwash');return zone+':'+game}
function canonical(api,current){
 const a=api?.authoritativeState||{};
 const profile={...(current?.profile||{}),...(api?.profile||{}),...(a.profile||{}),studentId:norm(a?.profile?.studentId||api?.studentId||current?.profile?.studentId)};
 const group=profile.group||a.group||api?.live?.group||current?.group||'A';
 const completed={pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false,gameSummary:false,...(api?.completed||{}),...(a.completed||{})};
 const gameCompleted={
  hygiene:{handwash:false,toothbrush:false,...(api?.gameCompleted?.hygiene||{}),...(a?.gameCompleted?.hygiene||{})},
  nutrition:{groups:false,goodjunk:false,...(api?.gameCompleted?.nutrition||{}),...(a?.gameCompleted?.nutrition||{})},
  fitness:{jumpduck:false,'balance-hold':false,...(api?.gameCompleted?.fitness||{}),...(a?.gameCompleted?.fitness||{})}
 };
 const progress={...(api?.progress||{}),...(a?.progress||{})};
 const evidence={...(api?.evidence||{}),...(a?.evidence||{})};
 const liveStep=String(api?.live?.currentStep||'').toLowerCase();
 const nextStep=String(progress.nextStep||'').toLowerCase();
 const progressRank=Math.max(Number(progress.completedCount)||0,Math.round((Number(progress.progressPct)||0)/100*(Number(progress.totalSteps)||9)));
 const assessmentEvidence=Math.max(Number(evidence.assessments)||0,Number(evidence.assessmentRows)||0,Number(evidence.assessmentCount)||0,Number(api?.assessmentCount)||0,Number(a?.assessmentCount)||0);
 const sheetMovedBeyondPretest=(progressRank>=1&&nextStep&&nextStep!=='pretest')||(liveStep&&liveStep!=='pretest'&&liveStep!=='login');
 if(assessmentEvidence>0||Number.isFinite(Number(api?.scores?.pretest))||Number.isFinite(Number(a?.scores?.pretest))||sheetMovedBeyondPretest)completed.pretest=true;
 if(completed.pretest&&(nextStep==='pretest'||progressRank<1||!nextStep))Object.assign(progress,{progressPct:Math.max(11,Number(progress.progressPct)||0),completedCount:Math.max(1,Number(progress.completedCount)||0),totalSteps:Number(progress.totalSteps)||9,nextStep:firstGameStep(group),missionComplete:false});
 return {...current,...a,profile,group,completed,gameCompleted,scores:{...(current?.scores||{}),...(api?.scores||{}),...(a?.scores||{})},gameScores:{...(current?.gameScores||{}),...(api?.gameScores||{}),...(a?.gameScores||{})},gameResults:{...(current?.gameResults||{}),...(api?.gameResults||{}),...(a?.gameResults||{})},reflection:a.reflection||api?.reflection||current?.reflection||null,authoritativeProgress:progress,sheetAuthority:true,offlineAuthority:false,legacyVerified:false,finalAuthorityVersion:VERSION,lastAuthoritySyncAt:new Date().toISOString(),view:'student',pendingProfile:null};
}
async function run(){
 const current=read(ACTIVE_KEY,{}),sid=norm(current?.profile?.studentId||localStorage.getItem('herohealth_active_student_id'));
 if(!sid)return;
 const onceKey='hh_final_authority_guard:'+VERSION+':'+sid;
 const q=new URLSearchParams(location.search);
 const force=q.has('authorityRefresh')||q.has('gameSync')||q.get('finalAuthority')==='1'||q.get('authorityApplied')!=='2';
 if(!force&&sessionStorage.getItem(onceKey))return;
 try{
  const api=await jsonp({action:'student',studentId:sid,force:'1'});
  if(!api||api.ok!==true)throw new Error(api?.error||'invalid_authority_response');
  const next=canonical(api,current);
  const before=JSON.stringify({c:current.completed,p:current.authoritativeProgress,g:current.gameCompleted});
  const after=JSON.stringify({c:next.completed,p:next.authoritativeProgress,g:next.gameCompleted});
  write(ACTIVE_KEY,next);write(PREFIX+sid,next);localStorage.setItem('herohealth_active_student_id',sid);sessionStorage.setItem(onceKey,String(Date.now()));
  if(before!==after||force){['authorityRefresh','gameSync','finalAuthority','v'].forEach(k=>q.delete(k));q.set('authorityApplied','2');location.replace(location.pathname+'?'+q.toString()+location.hash)}
 }catch(err){console.error('[Final Sheet Authority Guard]',err)}
}
addEventListener('DOMContentLoaded',()=>setTimeout(run,50));
window.HHFinalSheetAuthorityGuard={run,version:VERSION};
})();