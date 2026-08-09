(()=>{
'use strict';
const VERSION='2026-08-09-LCA47-FINAL-VOICE-RESCUE-V1';
const q=new URLSearchParams(location.search);
const PROD=q.get('from')==='passport'&&q.get('authority')==='firebase'&&q.get('qa')!=='1'&&q.get('submit')!=='0';
let armedAt=0,running=false,interval=0;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function api(){return window.LEXICON_CHAMPION_V47}
function state(){return api()?.state}
function summaryVisible(){const el=$('summary');return !!el&&!el.classList.contains('hidden')}
function gameVisible(){const el=$('game');return !!el&&!el.classList.contains('hidden')}
function finalVoiceComplete(){const st=state();return !!st&&Number(st.bossAttack)>=3&&Number(st.voiceScore)>=52}
function showSummary(){['intro','game','summary'].forEach(id=>$(id)?.classList.toggle('hidden',id!=='summary'))}
function computeMastery(st){const firstTryRate=Number(st.firstTryWins||0)/Math.max(1,Number(st.firstTryTotal||4));return clamp(Math.round(60+firstTryRate*15+Number(st.voiceScore||0)*.20+(st.fallback?0:5)),0,100)}
function computeRank(st){if(st.mastery>=90&&!st.fallback)return'S';if(st.mastery>=80)return'A';if(st.mastery>=65)return'B';return'C'}
function wait(ms){return new Promise(resolve=>{const started=Date.now();const id=setInterval(()=>{if(Date.now()-started>=ms){clearInterval(id);resolve()}},60)})}
function passportUrl(receipt){const p=new URLSearchParams({resume:'passport',fromGame:'final_boss',v:'20260809-final-voice-rescue1'});if(receipt)p.set('receipt',receipt);if(q.get('view')==='mobile')p.set('view','mobile');return './index.html?'+p.toString()}

async function rescue(){
 if(running||summaryVisible()||!finalVoiceComplete())return;
 running=true;
 const A=api(),st=state();
 try{speechSynthesis?.cancel()}catch(_){}
 st.mastery=computeMastery(st);
 const evidence=A?.getReceipt?.()||{};
 if($('rank'))$('rank').textContent=computeRank(st);
 if($('finalScore'))$('finalScore').textContent=String(st.score||0);
 if($('bodyResult'))$('bodyResult').textContent=`${Number(st.bodyPassed||0)}/2`;
 if($('voiceResult'))$('voiceResult').textContent=`${Number(st.voiceScore||0)}%`;
 if($('masteryResult'))$('masteryResult').textContent=`${Number(st.mastery||0)}%`;
 if($('summaryText'))$('summaryText').textContent='ผ่าน 4 Gates และ Final Boss ครบ 3 Attacks';
 if($('summaryMission'))$('summaryMission').textContent=`Mission Set ${A?.SET||evidence.missionSet||''}`;
 showSummary();
 const box=$('saveBox'),title=$('saveTitle'),detail=$('saveDetail'),ret=$('returnPassport'),retry=$('retrySave');
 box?.classList.remove('hidden','saved','error');
 if(ret){ret.disabled=true;ret.textContent='กำลังบันทึก Firebase…'}
 if(title)title.textContent=PROD?'กำลังบันทึกผล…':'Final Voice Complete ✓';
 if(detail)detail.textContent=PROD?'Final Voice Rescue • รอ Firebase receipt':'Final Voice Rescue completed';
 if(!PROD){running=false;return}
 try{
   if(!window.EW_AUTHORITY?.submitGame)throw new Error('FIREBASE_AUTHORITY_NOT_READY');
   const response=await window.EW_AUTHORITY.submitGame({playerId:A?.PID||q.get('pid')||q.get('playerId')||'',nickname:q.get('nickname')||'Player',stageId:'final_boss',score:st.mastery,total:100,durationMs:Number(evidence.durationMs||0),clientPoints:Number(st.score||0),answers:[{...evidence,mastery:st.mastery,voiceScore:st.voiceScore,clientPoints:st.score,rescueVersion:VERSION}],sourceVersion:VERSION});
   if(!response?.ok)throw new Error(response?.error||'SUBMIT_FAILED');
   const firebaseSaved=response.mode==='firebase'||response.authority?.mode==='firebase';
   if(!firebaseSaved)throw new Error(response.firebaseError||'FIREBASE_RECEIPT_REQUIRED');
   st.receipt=response.receiptId||response.resultId||'firebase-saved';
   box?.classList.add('saved');
   if(title)title.textContent=response.passed?'Firebase Saved ✓ • PASS':'Firebase Saved ✓ • NOT PASS';
   if(detail)detail.textContent=`Mastery ${st.mastery}% • Receipt ${st.receipt}`;
   try{sessionStorage.setItem(`ew_passport_receipt::${A?.PID||q.get('pid')||q.get('playerId')||''}::final_boss`,JSON.stringify({receipt:st.receipt,at:new Date().toISOString(),passed:Boolean(response.passed),accuracy:response.accuracy??st.mastery,missionSet:A?.SET||'',rescueVersion:VERSION}))}catch(_){}
   if(ret){ret.disabled=!response.passed;ret.textContent=response.passed?'Return to Passport':'ยังไม่ผ่าน • เล่นใหม่'}
   if(retry)retry.classList.add('hidden');
   if(response.passed){await wait(2400);location.replace(passportUrl(st.receipt))}
 }catch(error){
   console.error('[LCA Final Voice Rescue]',error);
   box?.classList.add('error');
   if(title)title.textContent='บันทึก Firebase ไม่สำเร็จ';
   if(detail)detail.textContent=String(error?.message||error);
   if(ret){ret.disabled=true;ret.textContent='รอการบันทึก'}
   retry?.classList.remove('hidden');
   running=false;
 }
}

function watch(){
 if(summaryVisible()){armedAt=0;return}
 if(gameVisible()&&finalVoiceComplete()){
   if(!armedAt)armedAt=Date.now();
   if(Date.now()-armedAt>=900)rescue();
 }else armedAt=0;
}
interval=setInterval(watch,120);
addEventListener('pagehide',()=>clearInterval(interval),{once:true});
window.LEXICON_CHAMPION_FINAL_VOICE_RESCUE=Object.freeze({version:VERSION,rescue});
console.info('[LEXICON Champion] Final Voice Rescue V1 ready');
})();