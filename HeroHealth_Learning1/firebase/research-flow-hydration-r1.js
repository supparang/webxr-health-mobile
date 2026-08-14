import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260814-research-flow-r1';
const KEY='herohealth_learning_platform_rc2';
const RELEASE='20260814-RESEARCH-FLOW-HYDRATION-R1';
const q=new URLSearchParams(location.search);
const mode=String(q.get('authority')||'firebase').toLowerCase();
if(!['firebase','dual'].includes(mode)){}else{
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}};
  const write=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}};
  const sid=String(q.get('studentId')||q.get('sid')||read()?.profile?.studentId||'').trim();
  async function hydrate(){
    if(!sid)return;
    try{
      const loaded=await HHFirebaseClient.loadProgress(sid);if(!loaded?.ok)return;
      const p=loaded.exists&&loaded.progress?loaded.progress:{};
      const s=read();if(String(s?.profile?.studentId||'')!==sid)return;
      const postExperience=p.postExperienceCompleted===true||p.completed?.postExperience===true||p.postExperience?.completed===true||!!p.postExperienceReceiptToken;
      const reflection=p.reflectionCompleted===true||p.completed?.reflection===true||p.reflection?.completed===true||!!p.reflectionReceiptToken;
      const researchImmediate=p.researchImmediateCompleted===true||p.completed?.researchImmediate===true||(postExperience&&reflection&&p.posttestCompleted===true);
      s.completed={...(s.completed||{}),postExperience,reflection,researchImmediate};
      s.postExperienceCompleted=postExperience;s.reflectionCompleted=reflection;s.researchImmediateCompleted=researchImmediate;
      if(p.postExperience)s.postExperience={...(s.postExperience||{}),...p.postExperience};
      if(p.reflection)s.reflection={...(s.reflection||{}),...p.reflection};
      s.firebaseResearchFlow={release:RELEASE,hydratedAt:new Date().toISOString(),postExperience,reflection,researchImmediate};
      write(s);window.dispatchEvent(new StorageEvent('storage',{key:KEY,newValue:JSON.stringify(s)}));
      console.info('[HeroHealth Research Flow Hydration]',RELEASE,{sid,postExperience,reflection,researchImmediate});
    }catch(error){console.warn('[HeroHealth Research Flow Hydration] skipped',error)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hydrate,900),{once:true});else setTimeout(hydrate,900);
}