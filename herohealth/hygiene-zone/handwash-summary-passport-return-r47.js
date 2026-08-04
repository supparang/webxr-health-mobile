(()=>{
'use strict';
const RELEASE='20260804-HANDWASH-SUMMARY-PASSPORT-RETURN-R49-FIREBASE-SAFE';

function findShellWindow(){
  let current=window;
  for(let i=0;i<8;i++){
    try{
      if(/\/HeroHealth_Learning1\/game-shell-authority-r(?:39|40|42)\.html$/i.test(current.location.pathname||''))return current;
      if(!current.parent||current.parent===current)break;
      current=current.parent;
    }catch(_){break}
  }
  return null;
}

function shellParams(shell){
  try{return new URLSearchParams(shell?.location?.search||'')}catch(_){return new URLSearchParams(location.search)}
}

function isComplete(){
  const root=document.documentElement.dataset;
  if(root.handwashProcedureComplete==='true')return true;
  try{
    const r=JSON.parse(localStorage.getItem('HHA_HANDWASH_LAST_RESULT')||'null');
    return !!(r&&(r.procedureCompleted||r.completed||r.missionPassed||r.progressionEligible));
  }catch(_){return false}
}

function buildPassportUrl(shell,complete){
  const params=shellParams(shell);
  const rawReturn=params.get('return')||params.get('returnUrl')||'./index.html';
  const url=new URL(rawReturn,shell?.location?.href||location.href);
  const sid=params.get('studentId')||params.get('sid')||params.get('pid')||new URLSearchParams(location.search).get('studentId')||'';
  const authority=params.get('authority')||new URLSearchParams(location.search).get('authority')||'';
  if(sid){url.searchParams.set('sid',sid);url.searchParams.set('studentId',sid)}
  if(authority)url.searchParams.set('authority',authority);
  url.searchParams.set('authorityRefresh',String(Date.now()));
  url.searchParams.set('gameReturn','handwash');
  url.searchParams.set('gameCompleted',complete?'1':'0');
  url.searchParams.set('returnRelease',RELEASE);
  if(complete){
    url.searchParams.delete('failedGame');
    url.searchParams.delete('noUnlock');
    url.searchParams.set('autoNext','0');
  }else{
    url.searchParams.set('failedGame','handwash');
    url.searchParams.set('noUnlock','1');
    url.searchParams.set('autoNext','0');
  }
  return url.href;
}

function emitBeforeReturn(shell){
  let result=null;
  try{result=JSON.parse(localStorage.getItem('HHA_HANDWASH_LAST_RESULT')||'null')}catch(_){}
  if(!result)return;
  result.skillPassed=true;
  result.passed=true;
  result.progressionEligible=true;
  result.classroomMissionPassed=true;
  try{shell?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:result},location.origin)}catch(_){}
  try{window.parent?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:result},location.origin)}catch(_){}
}

function returnToPassport(){
  const shell=findShellWindow();
  const complete=isComplete();
  if(complete)emitBeforeReturn(shell);
  const destination=buildPassportUrl(shell,complete);
  try{
    if(shell){shell.location.replace(destination)}else location.replace(destination);
    return true;
  }catch(error){
    console.error('[Handwash Return R49] passport navigation failed',error);
    return false;
  }
}

function install(){
  const button=document.getElementById('summaryZoneBtn');
  if(!button)return;
  button.removeAttribute('onclick');
  button.disabled=false;
  button.dataset.handwashReturnRelease=RELEASE;
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#summaryZoneBtn');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  button.disabled=true;
  button.textContent='กำลังบันทึกและกลับ Passport…';
  if(!returnToPassport()){
    button.disabled=false;
    button.textContent='บันทึกผลและกลับ Passport';
  }
},{capture:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('herohealth:game-result',()=>setTimeout(install,0));
setTimeout(install,500);

document.documentElement.dataset.handwashSummaryReturn=RELEASE;
window.HHHandwashSummaryPassportReturnR49={release:RELEASE,returnToPassport,isComplete};
console.info('[Handwash Summary Return R49] Firebase-safe return installed',RELEASE);
})();
