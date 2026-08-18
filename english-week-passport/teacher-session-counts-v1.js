(function(){
'use strict';
const VERSION='2026-08-18-TEACHER-SESSION-COUNTS-UI-V1';
const SESSION_IDS=['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM'];
const COOLDOWN_MS=30000;
let counts={},loadedAt=0,loading=false;
const $=id=>document.getElementById(id);
const clean=v=>String(v==null?'':v).trim();
function endpoint(){
 const configured=clean(window.EW_CONFIG?.firebaseSessionCountsUrl);
 if(configured)return configured;
 const teacher=clean(window.EW_CONFIG?.firebaseTeacherUrl);
 if(teacher&&/englishWeekTeacher\/?$/i.test(teacher))return teacher.replace(/englishWeekTeacher\/?$/i,'englishWeekSessionCounts');
 const project=clean(window.EW_CONFIG?.firebaseProjectId||'englishweek-95869');
 const region=clean(window.EW_CONFIG?.firebaseRegion||'asia-southeast1');
 return `https://${region}-${project}.cloudfunctions.net/englishWeekSessionCounts`;
}
function applyCounts(){
 const host=$('sessionCounts');if(!host)return;
 host.querySelectorAll('[data-session]').forEach(btn=>{
  const id=clean(btn.dataset.session),strong=btn.querySelector('strong');
  if(!strong||!Object.prototype.hasOwnProperty.call(counts,id))return;
  const next=String(Number(counts[id]||0));if(strong.textContent!==next)strong.textContent=next;
 });
}
function setButtonState(){const btn=$('refreshAllCountsBtn');if(btn)btn.disabled=loading}
async function loadCounts(force=false){
 if(loading)return counts;
 const wait=COOLDOWN_MS-(Date.now()-loadedAt);
 if(!force&&loadedAt&&wait>0){applyCounts();return counts}
 const user=window.firebase?.auth?.().currentUser;if(!user||user.isAnonymous)return counts;
 loading=true;setButtonState();
 try{
  const token=await user.getIdToken(false),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  let res;
  try{res=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'X-EW-App-Id':clean(window.EW_CONFIG?.appId||'ENGLISH-WEEK-PASSPORT-2026')},body:JSON.stringify({appId:clean(window.EW_CONFIG?.appId||'ENGLISH-WEEK-PASSPORT-2026')}),signal:ctrl.signal})}finally{clearTimeout(timer)}
  const data=await res.json().catch(()=>({}));if(!res.ok||data?.ok!==true)throw new Error(clean(data?.error||`HTTP_${res.status}`));
  counts={};SESSION_IDS.forEach(id=>counts[id]=Number(data?.counts?.[id]||0));loadedAt=Date.now();applyCounts();
  return counts;
 }catch(e){console.warn('[EW session counts]',e);applyCounts();return counts}finally{loading=false;setButtonState()}
}
function installObserver(){const host=$('sessionCounts');if(!host)return;new MutationObserver(()=>applyCounts()).observe(host,{childList:true,subtree:true})}
function bind(){
 installObserver();
 const refresh=$('refreshBtn');if(refresh)refresh.addEventListener('click',()=>setTimeout(()=>loadCounts(true),180));
 const refreshAll=$('refreshAllCountsBtn');if(refreshAll)refreshAll.addEventListener('click',()=>loadCounts(true));
 if(window.firebase?.auth)firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(()=>loadCounts(true),250)});
 setTimeout(()=>loadCounts(false),500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.EW_TEACHER_SESSION_COUNTS_V1=Object.freeze({version:VERSION,loadCounts,get counts(){return {...counts}},cooldownMs:COOLDOWN_MS});
})();
