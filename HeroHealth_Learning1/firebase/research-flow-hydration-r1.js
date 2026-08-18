import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260818-r78-canonical-reuse';
const KEY='herohealth_learning_platform_rc2';
const RELEASE='20260818-RESEARCH-FLOW-HYDRATION-R3-CANONICAL-REUSE';
const FRESH_TTL_MS=10000;
const q=new URLSearchParams(location.search);
const mode=String(q.get('authority')||'firebase').toLowerCase();
const CORE=[
 ['hygiene',['handwash','hand-wash']],['hygiene',['toothbrush','brush']],
 ['nutrition',['groups','foodgroups','food-groups']],['nutrition',['goodjunk','good-junk']],
 ['fitness',['jumpduck','jump-duck']],['fitness',['balance','balancehold','balance-hold']]
];
if(['firebase','dual'].includes(mode)){
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return{}}};
 const write=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}};
 const resultDone=r=>!!(r&&r.completed===true&&r.passed!==false&&r.progressionEligible!==false&&r.firebaseReceiptToken);
 const gameDone=(p,z,a)=>a.some(id=>p?.gameCompleted?.[z]?.[id]===true)||a.some(id=>resultDone(p?.gameResults?.[id]));
 const allGames=p=>CORE.every(([z,a])=>gameDone(p,z,a));
 const preDone=p=>p?.pretestCompleted===true&&p?.assessments?.pretest?.completed===true&&!!p?.assessments?.pretest?.firebaseReceiptToken;
 const postDone=p=>p?.posttestCompleted===true&&p?.assessments?.posttest?.completed===true&&!!p?.assessments?.posttest?.firebaseReceiptToken;
 const sidValues=['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean);
 const unique=[...new Set(sidValues)];
 const localSid=()=>{const s=read();const v=[s?.profile?.studentId,s?.firebaseAuthority?.studentId].map(x=>String(x||'').trim()).filter(Boolean),u=[...new Set(v)];return u.length===1?u[0]:''};
 const sid=unique.length===1?unique[0]:(unique.length===0?localSid():'');
 function freshCanonical(){
  const s=read();
  if(String(s?.profile?.studentId||'')!==sid||String(s?.firebaseAuthority?.studentId||'')!==sid)return null;
  if(String(s?.firebaseAuthority?.sourceOfTruth||'')!=='Cloud Firestore')return null;
  if(String(s?.firebaseResearchFlow?.sourceOfTruth||'')!=='Cloud Firestore')return null;
  const at=Date.parse(String(s?.firebaseAuthority?.hydratedAt||''));
  if(!Number.isFinite(at))return null;
  const age=Date.now()-at;
  return age>=0&&age<=FRESH_TTL_MS?s:null;
 }
 function announceReuse(s){
  window.dispatchEvent(new CustomEvent('hh:firebase-state-updated',{detail:{reason:'research-flow-canonical-reuse-r3',release:RELEASE}}));
  console.info('[HeroHealth Research Flow Hydration R3] reused Passport Firestore snapshot',{sid,ageMs:Date.now()-Date.parse(String(s?.firebaseAuthority?.hydratedAt||'')),research:s?.firebaseResearchFlow});
 }
 async function hydrate(){
  if(!sid)return;
  const fresh=freshCanonical();
  if(fresh){announceReuse(fresh);return;}
  try{
   const loaded=await HHFirebaseClient.loadProgress(sid);if(!loaded?.ok)return;
   const p=loaded.exists&&loaded.progress?loaded.progress:{};
   const s=read();if(String(s?.profile?.studentId||'')!==sid||String(s?.firebaseAuthority?.studentId||'')!==sid)return;
   const postExperience=p.postExperienceCompleted===true&&p.postExperience?.completed===true&&!!p.postExperienceReceiptToken;
   const reflection=p.reflectionCompleted===true&&p.reflection?.completed===true&&!!p.reflectionReceiptToken;
   const strictPrerequisites=preDone(p)&&allGames(p)&&postDone(p)&&postExperience&&reflection;
   const explicitResearch=p.researchImmediateCompleted===true&&p.researchImmediate?.completed===true;
   const researchImmediate=explicitResearch&&strictPrerequisites;
   s.completed={...(s.completed||{}),postExperience,reflection,researchImmediate};
   s.postExperienceCompleted=postExperience;s.reflectionCompleted=reflection;s.researchImmediateCompleted=researchImmediate;
   if(p.postExperience)s.postExperience={...(s.postExperience||{}),...p.postExperience};
   if(p.reflection)s.reflection={...(s.reflection||{}),...p.reflection};
   s.firebaseResearchFlow={release:RELEASE,sourceOfTruth:'Cloud Firestore',hydratedAt:new Date().toISOString(),pretest:preDone(p),sixGames:allGames(p),posttest:postDone(p),postExperience,reflection,researchImmediate};
   write(s);window.dispatchEvent(new CustomEvent('hh:firebase-state-updated',{detail:{reason:'research-flow-hydration-r3-fallback',release:RELEASE}}));
   console.info('[HeroHealth Research Flow Hydration R3] fallback Firestore read',{sid,...s.firebaseResearchFlow});
  }catch(error){console.warn('[HeroHealth Research Flow Hydration R3] skipped',error)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hydrate,700),{once:true});else setTimeout(hydrate,700);
}