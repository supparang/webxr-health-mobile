(()=>{
'use strict';
const VERSION='20260730-FINAL-SHEET-AUTHORITY-GUARD-V1';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
const PREFIX='herohealth_student_resume_v6:';
const ENDPOINT='https://script.google.com/macros/s/AKfycbxU82Rg4KFStuZToOGlyX-rgzVkLpZ7yO1tW-gzui782eR7akes_HNZ5ec2TDUDh8J1/exec';
const norm=v=>String(v==null?'':v).trim().replace(/\s+/g,'');
const read=(k,f=null)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}};
function jsonp(params,timeout=30000){return new Promise((resolve,reject)=>{const cb='HHFINAL_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);try{s.remove()}catch(_){}try{delete window[cb]}catch(_){}err?reject(err):resolve(data)};const timer=setTimeout(()=>finish(new Error('authority_timeout')),timeout);window[cb]=data=>finish(null,data);s.onerror=()=>finish(new Error('authority_load_failed'));s.src=ENDPOINT+'?'+new URLSearchParams({...params,callback:cb,_:Date.now()}).toString();(document.head||document.documentElement).appendChild(s)})}
function canonical(api,current){
 const a=api?.authoritativeState||{};
 const profile={...(current?.profile||{}),...(api?.profile||{}),...(a.profile||{}),studentId:norm(a?.profile?.studentId||api?.studentId||current?.profile?.studentId)};
 const completed={pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false,gameSummary:false,...(api?.completed||{}),...(a.completed||{})};
 const gameCompleted={
  hygiene:{handwash:false,toothbrush:false,...(api?.gameCompleted?.hygiene||{}),...(a?.gameCompleted?.hygiene||{})},
  nutrition:{groups:false,goodjunk:false,...(api?.gameCompleted?.nutrition||{}),...(a?.gameCompleted?.nutrition||{})},
  fitness:{jumpduck:false,'balance-hold':false,...(api?.gameCompleted?.fitness||{}),...(a?.gameCompleted?.fitness||{})}
 };
 const progress={...(api?.progress||{}),...(a?.progress||{})};
 const evidence={...(api?.evidence||{}),...(a?.evidence||{})};
 if((Number(evidence.assessments)||0)>0||Number.isFinite(Number(api?.scores?.pretest))||Number.isFinite(Number(a?.scores?.pretest)))completed.pretest=true;
 if(completed.pretest&&(String(progress.nextStep||'').toLowerCase()==='pretest'||Number(progress.completedCount||0)<1))Object.assign(progress,{progressPct:Math.max(11,Number(progress.progressPct)||0),completedCount:Math.max(1,Number(progress.completedCount)||0),totalSteps:Number(progress.totalSteps)||9,nextStep:'hygiene:handwash',missionComplete:false});
 return {...current,...a,profile,group:profile.group||a.group||current?.group||'A',completed,gameCompleted,scores:{...(current?.scores||{}),...(api?.scores||{}),...(a?.scores||{})},gameScores:{...(current?.gameScores||{}),...(api?.gameScores||{}),...(a?.gameScores||{})},gameResults:{...(current?.gameResults||{}),...(api?.gameResults||{}),...(a?.gameResults||{})},reflection:a.reflection||api?.reflection||current?.reflection||null,authoritativeProgress:progress,sheetAuthority:true,offlineAuthority:false,legacyVerified:false,finalAuthorityVersion:VERSION,lastAuthoritySyncAt:new Date().toISOString(),view:'student',pendingProfile:null};
}
async function run(){
 const current=read(ACTIVE_KEY,{}),sid=norm(current?.profile?.studentId||localStorage.getItem('herohealth_active_student_id'));
 if(!sid)return;
 const onceKey='hh_final_authority_guard:'+VERSION+':'+sid;
 const q=new URLSearchParams(location.search);
 const force=q.has('authorityRefresh')||q.has('gameSync')||q.get('finalAuthority')==='1';
 if(!force&&sessionStorage.getItem(onceKey))return;
 try{
  const api=await jsonp({action:'student',studentId:sid});
  if(!api||api.ok!==true)throw new Error(api?.error||'invalid_authority_response');
  const next=canonical(api,current);
  const before=JSON.stringify({c:current.completed,p:current.authoritativeProgress,g:current.gameCompleted});
  const after=JSON.stringify({c:next.completed,p:next.authoritativeProgress,g:next.gameCompleted});
  write(ACTIVE_KEY,next);write(PREFIX+sid,next);localStorage.setItem('herohealth_active_student_id',sid);sessionStorage.setItem(onceKey,String(Date.now()));
  if(before!==after||force){['authorityRefresh','gameSync','finalAuthority'].forEach(k=>q.delete(k));q.set('authorityApplied','1');q.set('v','20260730-final-authority-v1');location.replace(location.pathname+'?'+q.toString()+location.hash)}
 }catch(err){console.error('[Final Sheet Authority Guard]',err)}
}
addEventListener('DOMContentLoaded',()=>setTimeout(run,50));
window.HHFinalSheetAuthorityGuard={run,version:VERSION};
})();