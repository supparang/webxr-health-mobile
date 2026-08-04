(()=>{
'use strict';
const RELEASE='20260804-HANDWASH-SUMMARY-RETURN-R51-FIREBASE-RECEIPT';
const PASSPORT_STATE_KEY='herohealth_learning_platform_rc2';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';
const RECEIPT_KEY='HH_FIREBASE_GAME_RECEIPT:990014:handwash';
const FIREBASE_CLIENT_URL='/webxr-health-mobile/HeroHealth_Learning1/firebase/herohealth-firebase-client.js?cv='+encodeURIComponent(RELEASE);
let saving=false;
let returned=false;
let autoTimer=0;
let latestEventResult=null;

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
function storedResult(){return latestEventResult||readJson(RESULT_KEY)||{}}
function clean(v){return String(v==null?'':v).trim()}
function yes(v){return v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1'}

function authorityContext(shell){
  const params=shellParams(shell);
  const localParams=new URLSearchParams(location.search);
  const state=passportState();
  const result=storedResult();
  const firebaseAuthority=state.firebaseAuthority||window.HH_FIREBASE_AUTHORITY||{};
  let authority=clean(params.get('authority')||localParams.get('authority')||result.authority||firebaseAuthority.mode||'');
  const firebaseUid=clean(params.get('firebaseUid')||localParams.get('firebaseUid')||result.firebaseUid||firebaseAuthority.uid||state.firebaseUid||'');
  const marker=clean(sessionStorage.getItem('HH_AUTHORITY_MODE')||localStorage.getItem('HH_AUTHORITY_MODE')||'');
  const sid=clean(params.get('studentId')||params.get('sid')||params.get('pid')||localParams.get('studentId')||result.studentId||result.participantId||state.profile?.studentId||'990014');
  if(!authority&&(firebaseUid||firebaseAuthority.uid||marker==='firebase'||sid==='990014'))authority='firebase';
  return{authority:authority.toLowerCase(),firebaseUid,sid,state,result,params};
}

function isComplete(result=storedResult()){
  const root=document.documentElement.dataset;
  return root.handwashProcedureComplete==='true'||yes(result?.procedureCompleted)||yes(result?.completed)||yes(result?.missionPassed)||yes(result?.progressionEligible);
}

function prepareResult(ctx){
  const source={...storedResult()};
  if(!isComplete(source))throw new Error('handwash-result-not-complete');
  const independentSkillPassed=yes(source.independentSkillPassed??source.skillAssessmentPassed??source.skillCriteriaMet);
  const result={
    ...source,
    studentId:ctx.sid,
    participantId:ctx.sid,
    authority:'firebase',
    firebaseUid:ctx.firebaseUid||source.firebaseUid||'',
    gameId:'handwash',
    zone:'hygiene',
    completed:true,
    procedureCompleted:true,
    missionPassed:true,
    classroomMissionPassed:true,
    passed:true,
    skillPassed:true,
    progressionEligible:true,
    independentSkillPassed,
    completionLevel:independentSkillPassed?'independent':'completed_with_adaptive_assist',
    firebaseReturnRelease:RELEASE,
    firebaseSaveRequestedAt:new Date().toISOString()
  };
  try{localStorage.setItem(RESULT_KEY,JSON.stringify(result))}catch(_){}
  return result;
}

function setStatus(message,error=false){
  const button=document.getElementById('summaryZoneBtn');
  if(button){
    button.disabled=saving&&!error;
    button.textContent=message;
    button.style.opacity='1';
  }
  let node=document.getElementById('hhFirebaseReturnStatus');
  if(!node){
    node=document.createElement('div');
    node.id='hhFirebaseReturnStatus';
    node.style.cssText='margin:10px 0;padding:10px 12px;border-radius:12px;font:800 12px/1.4 system-ui;text-align:center';
    const actions=document.querySelector('#summaryOverlay .actions');
    if(actions)actions.before(node);
  }
  if(node){
    node.textContent=message;
    node.style.background=error?'#fee2e2':'#dcfce7';
    node.style.color=error?'#991b1b':'#166534';
  }
}

function buildPassportUrl(shell,ctx,receipt){
  const rawReturn=ctx.params.get('return')||ctx.params.get('returnUrl')||'./index.html';
  const url=new URL(rawReturn,shell?.location?.href||location.href);
  url.searchParams.set('sid',ctx.sid);
  url.searchParams.set('studentId',ctx.sid);
  url.searchParams.set('authority','firebase');
  if(ctx.firebaseUid||receipt?.user?.uid)url.searchParams.set('firebaseUid',ctx.firebaseUid||receipt.user.uid);
  url.searchParams.set('firebaseReady','1');
  url.searchParams.set('firebaseReceipt','1');
  url.searchParams.set('authorityRefresh',String(Date.now()));
  url.searchParams.set('gameReturn','handwash');
  url.searchParams.set('gameCompleted','1');
  url.searchParams.set('autoNext','0');
  url.searchParams.set('returnRelease',RELEASE);
  url.searchParams.delete('failedGame');
  url.searchParams.delete('noUnlock');
  return url.href;
}

function emitBeforeReturn(shell,result){
  try{shell?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:result},location.origin)}catch(_){}
  try{window.parent?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:result},location.origin)}catch(_){}
}

async function saveFirebaseAndReturn(reason='automatic'){
  if(saving||returned)return false;
  const shell=findShellWindow();
  const ctx=authorityContext(shell);
  if(ctx.authority!=='firebase'){
    setStatus('รอบนี้ไม่ได้เปิดด้วย Firebase จึงยังไม่กลับ Passport',true);
    return false;
  }
  saving=true;
  setStatus('กำลังบันทึกผลลง Firebase…');
  try{
    const result=prepareResult(ctx);
    const module=await import(FIREBASE_CLIENT_URL);
    const client=module.HHFirebaseClient;
    if(!client?.saveGameResult)throw new Error('firebase-client-saveGameResult-missing');
    const receipt=await client.saveGameResult(ctx.sid,'handwash',result);
    if(!receipt?.ok||receipt?.result?.firebaseReceiptToken!==receipt?.token){
      throw new Error('firebase-receipt-not-confirmed');
    }
    const receiptRecord={
      ok:true,
      studentId:ctx.sid,
      gameId:'handwash',
      token:receipt.token,
      path:receipt.path,
      uid:receipt.user?.uid||'',
      confirmedAt:new Date().toISOString(),
      release:RELEASE,
      reason
    };
    try{localStorage.setItem(RECEIPT_KEY,JSON.stringify(receiptRecord))}catch(_){}
    result.firebaseReceiptToken=receipt.token;
    result.firebaseReceiptConfirmed=true;
    result.firebaseReceiptPath=receipt.path;
    try{localStorage.setItem(RESULT_KEY,JSON.stringify(result))}catch(_){}
    emitBeforeReturn(shell,result);
    setStatus('บันทึก Firebase และยืนยันข้อมูลแล้ว • กำลังกลับ Passport');
    console.info('[Handwash Return R51] Firebase receipt confirmed',receiptRecord);
    returned=true;
    const destination=buildPassportUrl(shell,ctx,receipt);
    setTimeout(()=>{
      try{if(shell)shell.location.replace(destination);else location.replace(destination)}
      catch(error){returned=false;saving=false;setStatus('กลับ Passport ไม่สำเร็จ • กดเพื่อลองใหม่',true);console.error(error)}
    },850);
    return true;
  }catch(error){
    saving=false;
    console.error('[Handwash Return R51] Firebase save failed',error);
    setStatus('ยังบันทึก Firebase ไม่สำเร็จ • กดเพื่อลองใหม่',true);
    const button=document.getElementById('summaryZoneBtn');
    if(button)button.disabled=false;
    return false;
  }
}

function install(){
  const button=document.getElementById('summaryZoneBtn');
  if(!button)return;
  button.removeAttribute('onclick');
  button.disabled=false;
  button.dataset.handwashReturnRelease=RELEASE;
  if(isComplete()&&!saving&&!returned)button.textContent='บันทึก Firebase และกลับ Passport';
}

function scheduleAutomaticReturn(result){
  if(result&&typeof result==='object')latestEventResult=result;
  clearTimeout(autoTimer);
  autoTimer=setTimeout(()=>{
    if(isComplete())saveFirebaseAndReturn('automatic-summary-complete');
  },1400);
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#summaryZoneBtn');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  saveFirebaseAndReturn('manual-retry-button');
},{capture:true});

window.addEventListener('herohealth:game-result',event=>{
  setTimeout(install,0);
  scheduleAutomaticReturn(event.detail||{});
});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(()=>{
  install();
  if(isComplete())scheduleAutomaticReturn(storedResult());
},600);

document.documentElement.dataset.handwashSummaryReturn=RELEASE;
window.HHHandwashSummaryPassportReturnR51={release:RELEASE,saveFirebaseAndReturn,isComplete,authorityContext};
console.info('[Handwash Summary Return R51] automatic Firebase receipt gate installed',RELEASE);
})();
