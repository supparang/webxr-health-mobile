(()=>{
'use strict';
const q=new URLSearchParams(location.search);
const passportContext=q.get('from')==='passport'||q.get('shell')==='1';
if(!passportContext)return;
function passportUrl(){
  const p=new URLSearchParams({resume:'passport',fromGame:'final_boss',v:'20260811-champion-back-guard-v1'});
  if(q.get('view'))p.set('view',q.get('view'));
  return './index.html?'+p.toString();
}
function goPassport(){
  try{
    if(window.parent&&window.parent!==window&&window.parent.location){
      window.parent.location.replace(passportUrl());
      return;
    }
  }catch(_){ }
  location.replace(passportUrl());
}
function applyProductionUi(){
  document.querySelectorAll('.qaOnly').forEach(el=>el.classList.add('hidden'));
  document.querySelectorAll('.productionOnly').forEach(el=>el.classList.remove('hidden'));
  const subtitle=document.getElementById('subtitle');
  if(subtitle)subtitle.textContent='GAME 5 • 4 GATES + FINAL BOSS';
  const introBack=document.getElementById('qaHubIntro');
  const summaryBack=document.getElementById('qaHubSummary');
  if(introBack)introBack.textContent='Back to Passport';
  if(summaryBack)summaryBack.textContent='Back to Passport';
}
['back','qaHubIntro','qaHubSummary'].forEach(id=>{
  const el=document.getElementById(id);
  if(!el)return;
  el.addEventListener('click',ev=>{
    ev.preventDefault();
    ev.stopImmediatePropagation();
    goPassport();
  },true);
});
applyProductionUi();
setTimeout(applyProductionUi,0);
console.info('[LEXICON X] Passport Back Guard V1 active');
})();