(() => {
'use strict';
const KEY='herohealth_learning_platform_rc2';
const SUMMARY_ROUTE='./game-summary.html';
const FIREBASE_SUMMARY_ROUTE='./assessment/mission-summary-firebase-r10.html';
const RELEASE='20260818-OVERALL-SUMMARY-RESEARCH-GATE-R6-STRICT';
const CORE=[
 ['hygiene',['handwash','hand-wash']],['hygiene',['toothbrush','brush']],
 ['nutrition',['groups','foodgroups','food-groups']],['nutrition',['goodjunk','good-junk']],
 ['fitness',['jumpduck','jump-duck']],['fitness',['balance','balancehold','balance-hold']]
];
function readState(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return{}}}
function authorityMode(){const query=new URLSearchParams(location.search),explicit=String(query.get('authority')||'').toLowerCase();if(explicit)return explicit;try{const stored=String(localStorage.getItem('HH_AUTHORITY_MODE')||sessionStorage.getItem('HH_AUTHORITY_MODE')||'').toLowerCase();if(stored)return stored}catch(_){}return String(readState()?.firebaseAuthority?.mode||'').toLowerCase()}
function sidFromPage(){const q=new URLSearchParams(location.search),state=readState(),values=[q.get('studentId'),q.get('sid'),q.get('pid')].map(v=>String(v||'').trim()).filter(Boolean),unique=[...new Set(values)];if(unique.length>1)return'';return unique[0]||String(state?.profile?.studentId||'').trim()}
const resultPassed=result=>!!(result&&result.completed===true&&result.passed!==false&&result.progressionEligible!==false&&result.firebaseReceiptToken);
const gameDone=(p,z,a)=>a.some(id=>p?.gameCompleted?.[z]?.[id]===true)||a.some(id=>resultPassed(p?.gameResults?.[id]));
function firebaseFlowComplete(p){
 if(!p||typeof p!=='object')return false;
 const pre=p.pretestCompleted===true&&p.assessments?.pretest?.completed===true&&!!p.assessments?.pretest?.firebaseReceiptToken;
 const allGames=CORE.every(([z,a])=>gameDone(p,z,a));
 const post=p.posttestCompleted===true&&p.assessments?.posttest?.completed===true&&!!p.assessments?.posttest?.firebaseReceiptToken;
 const postExperience=p.postExperienceCompleted===true&&p.postExperience?.completed===true&&!!p.postExperienceReceiptToken;
 const reflection=p.reflectionCompleted===true&&p.reflection?.completed===true&&!!p.reflectionReceiptToken;
 const research=p.researchImmediateCompleted===true&&p.researchImmediate?.completed===true;
 return pre&&allGames&&post&&postExperience&&reflection&&research;
}
function firebaseSummaryUrl(sid){const url=new URL(FIREBASE_SUMMARY_ROUTE,location.href);url.searchParams.set('authority','firebase');url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.set('authorityRefresh',String(Date.now()));url.searchParams.set('v',RELEASE);return url.href}
let firebaseSummaryReady=false,firebaseSummaryHref='';
function normalizeCompletedFirebaseUI(){
 if(!firebaseSummaryReady||!firebaseSummaryHref)return;
 document.querySelectorAll('button,a').forEach(node=>{const label=String(node.textContent||'').replace(/\s+/g,' ').trim();if(!label.includes('ดูผลสำเร็จ')||node.dataset.hhCompletedSummaryR6==='1')return;node.dataset.hhCompletedSummaryR6='1';node.removeAttribute('onclick');if(node.tagName==='A')node.setAttribute('href',firebaseSummaryHref);node.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();location.assign(firebaseSummaryHref)},true)});
 document.querySelectorAll('p.muted,.muted,[data-next-label],[data-next-step]').forEach(node=>{const text=String(node.textContent||'').replace(/\s+/g,' ').trim();if(text.includes('Reflection'))node.textContent='ดูสรุปภารกิจและรับใบประกาศ'});
}
async function installFirebaseCompletedFlowGuard(){
 const sid=sidFromPage();if(!sid)return;
 try{
  const clientUrl=new URL('./firebase/herohealth-firebase-client.js?cv=20260818-summary-research-r6-strict',location.href).href;
  const{HHFirebaseClient}=await import(clientUrl);const loaded=await HHFirebaseClient.loadProgress(sid);
  if(!loaded?.ok||!firebaseFlowComplete(loaded.progress))return;
  firebaseSummaryReady=true;firebaseSummaryHref=firebaseSummaryUrl(sid);normalizeCompletedFirebaseUI();
  new MutationObserver(normalizeCompletedFirebaseUI).observe(document.documentElement,{childList:true,subtree:true,characterData:true});addEventListener('storage',normalizeCompletedFirebaseUI);
 }catch(error){console.warn('[HeroHealth Overall Summary R6] strict Firebase gate skipped',error)}
}
if(['firebase','dual'].includes(authorityMode())){installFirebaseCompletedFlowGuard();return}
function allZonesComplete(state){return['hygiene','nutrition','fitness'].every(id=>state?.completed?.[id]===true)}
function summaryComplete(state){return state?.completed?.gameSummary===true}
function queryForProfile(state){const p=state?.profile||{},q=new URLSearchParams();if(p.studentId)q.set('studentId',p.studentId);if(p.fullName)q.set('fullName',p.fullName);if(p.section)q.set('section',p.section);if(state?.group||p.group)q.set('group',state.group||p.group);q.set('return',location.href);return q.toString()}
function openSummary(){const state=readState();if(!allZonesComplete(state)){alert('ยังเล่นเกมไม่ครบทุกฐาน กรุณากลับไปทำภารกิจที่ยังไม่ครบ');return}location.href=`${SUMMARY_ROUTE}?${queryForProfile(state)}`}
function patchPosttestButton(){const state=readState();if(!allZonesComplete(state)||summaryComplete(state)||state?.completed?.posttest)return;document.querySelectorAll('button').forEach(btn=>{const label=(btn.textContent||'').trim(),onclick=btn.getAttribute('onclick')||'';if(label.includes('Post-test')||onclick.includes("openRoute('posttest')")){btn.textContent='ดูสรุปการเล่นทั้งหมด';btn.removeAttribute('onclick');btn.onclick=openSummary}})}
function installRouteGuard(){if(!window.HH||window.HH.__summaryGateInstalled)return;const original=window.HH.openRoute?.bind(window.HH);window.HH.openRoute=function(id){const state=readState();if(id==='summary')return openSummary();if(id==='posttest'&&allZonesComplete(state)&&!summaryComplete(state))return openSummary();return original?original(id):undefined};window.HH.__summaryGateInstalled=true}
function apply(){installRouteGuard();patchPosttestButton()}new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});addEventListener('storage',apply);apply();
})();