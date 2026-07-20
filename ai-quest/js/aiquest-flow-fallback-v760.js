(()=>{'use strict';
const ENDPOINT='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
async function post(payload){const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});const t=await r.text();try{return JSON.parse(t)}catch(e){throw Error('FLOW_NON_JSON: '+t.slice(0,200))}}
function install(){if(!window.AIQuestSync)return false;if(window.AIQuestSync.__flow760)return true;const oldProfile=window.AIQuestSync.lookupProfile,oldProgress=window.AIQuestSync.lookupProgress;
window.AIQuestSync.lookupProfile=async p=>{try{const r=await oldProfile(p);if(r?.ok&&r?.found)return r}catch(e){}return post({module:'AIQFLOW',action:'LOOKUP_PROFILE',studentId:p?.studentId||'',section:p?.section||'101'})};
window.AIQuestSync.lookupProgress=async p=>{try{const r=await oldProgress(p);if(r&&(r.ok||r.found||r.progress||r.attempts||r.missions||r.summary||r.data))return r}catch(e){}return post({module:'AIQFLOW',action:'GET_FLOW_PROGRESS',studentId:p?.studentId||'',section:p?.section||'101'})};
window.AIQuestSync.__flow760=true;console.log('[AIQuest] official flow fallback v760 active');return true}
let tries=0;const timer=setInterval(()=>{if(install()||++tries>80)clearInterval(timer)},100);if(document.readyState!=='loading')install();else document.addEventListener('DOMContentLoaded',install,{once:true});
window.AIQuestFlowFallbackV760={install,version:'v760'};
})();
