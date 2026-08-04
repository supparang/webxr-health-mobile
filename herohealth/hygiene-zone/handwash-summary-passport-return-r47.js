(()=>{
'use strict';
const RELEASE='20260804-HANDWASH-SUMMARY-PASSPORT-RETURN-R50-FIREBASE-PRESERVE';
const PASSPORT_STATE_KEY='herohealth_learning_platform_rc2';

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
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}}
function passportState(){return readJson(PASSPORT_STATE_KEY)||{}}
function storedResult(){return readJson('HHA_HANDWASH_LAST_RESULT')||{}}
function clean(v){return String(v==null?'':v).trim()}

function authorityContext(shell){
  const params=shellParams(shell);
  const localParams=new URLSearchParams(location.search);
  const state=passportState();
  const result=storedResult();
  const firebaseAuthority=state.firebaseAuthority||window.HH_FIREBASE_AUTHORITY||{};
  let authority=clean(params.get('authority')||localParams.get('authority')||result.authority||firebaseAuthority.mode||'');
  const firebaseUid=clean(params.get('firebaseUid')||localParams.get('firebaseUid')||result.firebaseUid||firebaseAuthority.uid||state.firebaseUid||'');
  const marker=clean(sessionStorage.getItem('HH_AUTHORITY_MODE')||localStorage.getItem('HH_AUTHORITY_MODE')||'');
  if(!authority&&(firebaseUid||firebaseAuthority.uid||marker==='firebase'))authority='firebase';
  const sid=clean(params.get('studentId')||params.get('sid')||params.get('pid')||localParams.get('studentId')||result.studentId||result.participantId||state.profile?.studentId||'');
  return{authority:authority.toLowerCase(),firebaseUid,sid,state,result,params};
}

function isComplete(){
  const root=document.documentElement.dataset;
  if(root.handwashProcedureComplete==='true')return true;
  const r=storedResult();
  return !!(r&&(r.procedureCompleted||r.completed||r.missionPassed||r.progressionEligible));
}

function buildPassportUrl(shell,complete){
  const ctx=authorityContext(shell);
  const rawReturn=ctx.params.get('return')||ctx.params.get('returnUrl')||'./index.html';
  const url=new URL(rawReturn,shell?.location?.href||location.href);
  if(ctx.sid){url.searchParams.set('sid',ctx.sid);url.searchParams.set('studentId',ctx.sid)}
  if(ctx.authority)url.searchParams.set('authority',ctx.authority);
  if(ctx.authority==='firebase'){
    url.searchParams.set('authority','firebase');
    if(ctx.firebaseUid)url.searchParams.set('firebaseUid',ctx.firebaseUid);
    url.searchParams.set('firebaseReady','1');
  }
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
  const result=storedResult();
  if(!result||!Object.keys(result).length)return;
  const ctx=authorityContext(shell);
  result.skillPassed=true;
  result.passed=true;
  result.progressionEligible=true;
  result.classroomMissionPassed=true;
  if(ctx.authority)result.authority=ctx.authority;
  if(ctx.firebaseUid)result.firebaseUid=ctx.firebaseUid;
  if(ctx.sid&&!result.studentId)result.studentId=ctx.sid;
  try{localStorage.setItem('HHA_HANDWASH_LAST_RESULT',JSON.stringify(result))}catch(_){}
  try{shell?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:result},location.origin)}catch(_){}
  try{window.parent?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:result},location.origin)}catch(_){}
}

function returnToPassport(){
  const shell=findShellWindow();
  const complete=isComplete();
  if(complete)emitBeforeReturn(shell);
  const destination=buildPassportUrl(shell,complete);
  console.info('[Handwash Return R50] navigating',destination);
  try{
    if(shell){shell.location.replace(destination)}else location.replace(destination);
    return true;
  }catch(error){
    console.error('[Handwash Return R50] passport navigation failed',error);
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
window.HHHandwashSummaryPassportReturnR50={release:RELEASE,returnToPassport,isComplete,authorityContext};
console.info('[Handwash Summary Return R50] Firebase authority preservation installed',RELEASE);
})();
