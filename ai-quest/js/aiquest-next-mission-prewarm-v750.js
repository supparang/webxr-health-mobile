/* CSAI2102 AI Quest — Next Mission Prewarm v7.5.0
   Performance-only helper. It never unlocks a mission and never creates progress.
   After Google Sheet has confirmed the current mission, it prefetches the exact
   adjacent page and stores only canonical URL identity for the same tab session.
*/
(()=>{'use strict';
if(window.AIQuestNextMissionPrewarmV750)return;
const VERSION='v7.5.0';
const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
const clean=v=>String(v==null?'':v).trim();
const norm=x=>clean(x).toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
const params=()=>new URL(location.href).searchParams;
const current=()=>norm(params().get('mission')||'s1');
function nextMission(id=current()){const i=ORDER.indexOf(norm(id));return i>=0?ORDER[i+1]||'':''}
function identity(){return{studentId:clean(document.getElementById('sid')?.value||params().get('studentId')),studentName:clean(document.getElementById('name')?.value||params().get('studentName')),section:clean(document.getElementById('sec')?.value||params().get('section')||'101')}}
function targetUrl(){const next=nextMission();if(!next)return new URL('./course-map-all-v715.html?route=student-v715',location.href).toString();const u=new URL(location.href);u.searchParams.set('mission',next);u.searchParams.set('release','challenge711');u.searchParams.delete('_gate');return u.toString()}
function rememberIdentity(){const who=identity();if(!who.studentId||who.section!=='101')return;try{sessionStorage.setItem('CSAI2102_CANONICAL_IDENTITY_V750',JSON.stringify({...who,source:'verified-adjacent-navigation',savedAt:Date.now()}))}catch(_){}}
let warmed='';
function prewarm(){const state=window.CSAI2102_REFLECTION_GATE_CONFIRMED;if(!state||state.missionId!==current()||state.gate?.completed!==true)return false;const href=targetUrl();if(!href||warmed===href)return true;warmed=href;rememberIdentity();let link=document.querySelector('link[data-aiquest-next-prewarm]');if(!link){link=document.createElement('link');link.rel='prefetch';link.as='document';link.dataset.aiquestNextPrewarm='1';document.head.appendChild(link)}link.href=href;console.log('[AIQuest] next mission prewarmed',nextMission(),href);return true}
function boot(){
 const observer=new MutationObserver(()=>{if(prewarm())observer.disconnect()});
 const result=document.getElementById('result')||document.body;observer.observe(result,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-sheet-confirmed','href','style']});
 document.addEventListener('pointerdown',e=>{const next=e.target?.closest?.('#nextMission');if(next&&next.dataset.sheetConfirmed==='1'){rememberIdentity();prewarm()}},true);
 if(!prewarm())setTimeout(prewarm,1500);
 console.log('[AIQuest] next mission prewarm v750 active • no unlock authority');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestNextMissionPrewarmV750={version:VERSION,nextMission,targetUrl,prewarm,identity};
})();