(()=>{
'use strict';

const RELEASE='20260804-PROFILE-CONFIRM-ROUTE-GUARD-R53-FIREBASE-RECEIPT';
const STATE_KEY='herohealth_learning_platform_rc2';
const FIREBASE_RECEIPT_KEY='HH_FIREBASE_GAME_RECEIPT:990014:handwash';
let installTimer=0;
let installAttempts=0;

const clean=value=>String(value==null?'':value).trim().replace(/\s+/g,'');
function readJson(key){
  try{return JSON.parse(localStorage.getItem(key)||'null')}
  catch(_){return null}
}
function readState(){return readJson(STATE_KEY)||{}}
function writeState(value){
  try{localStorage.setItem(STATE_KEY,JSON.stringify(value));return true}
  catch(error){console.error('[Profile Route R53] state write failed',error);return false}
}
function validFirebaseReceipt(){
  const receipt=readJson(FIREBASE_RECEIPT_KEY);
  return !!(receipt&&receipt.ok===true&&clean(receipt.studentId)==='990014'&&clean(receipt.gameId)==='handwash'&&clean(receipt.token));
}
function firebaseContext(){
  const url=new URL(location.href);
  const state=readState();
  const receipt=readJson(FIREBASE_RECEIPT_KEY)||{};
  const explicit=clean(url.searchParams.get('authority')).toLowerCase()==='firebase';
  const receiptReturn=url.searchParams.get('firebaseReceipt')==='1'||validFirebaseReceipt();
  const stateMode=clean(state?.firebaseAuthority?.mode||state?.authorityMode).toLowerCase()==='firebase';
  const enabled=explicit||receiptReturn||stateMode;
  const sid=clean(url.searchParams.get('studentId')||url.searchParams.get('sid')||receipt.studentId||state?.profile?.studentId||'');
  const uid=clean(url.searchParams.get('firebaseUid')||receipt.uid||state?.firebaseUid||state?.firebaseAuthority?.uid||'');
  return{enabled,sid,uid,receipt,url};
}
function recoverFirebaseRoute(){
  const ctx=firebaseContext();
  if(!ctx.enabled||!ctx.sid)return false;
  const url=ctx.url;
  const already=url.searchParams.get('authority')==='firebase'&&url.searchParams.get('studentId')===ctx.sid;
  sessionStorage.setItem('HH_AUTHORITY_MODE','firebase');
  localStorage.setItem('HH_AUTHORITY_MODE','firebase');
  if(already)return false;
  url.searchParams.set('authority','firebase');
  url.searchParams.set('studentId',ctx.sid);
  url.searchParams.set('sid',ctx.sid);
  url.searchParams.set('firebaseReady','1');
  url.searchParams.set('firebaseReceipt',validFirebaseReceipt()?'1':url.searchParams.get('firebaseReceipt')||'0');
  if(ctx.uid)url.searchParams.set('firebaseUid',ctx.uid);
  url.searchParams.delete('authorityApplied');
  url.searchParams.set('firebaseRecovered',RELEASE);
  console.warn('[Profile Route R53] restoring Firebase authority from confirmed receipt',url.href);
  location.replace(url.href);
  return true;
}
function toast(message){
  const node=document.createElement('div');
  node.className='toast';
  node.textContent=message;
  document.body.appendChild(node);
  setTimeout(()=>node.remove(),7000);
}
function alignRoute(studentId){
  const sid=clean(studentId);
  if(!sid)return false;
  const ctx=firebaseContext();
  const url=new URL(location.href);
  const previousSid=clean(url.searchParams.get('sid'));
  const previousStudentId=clean(url.searchParams.get('studentId'));

  const removable=['sid','studentId','authorityApplied','authorityRefresh','gameSync','autoNext','pendingGameSync','confirmedNext','fromGame','completedGame','plannerReturn'];
  removable.forEach(key=>url.searchParams.delete(key));
  url.searchParams.set('sid',sid);
  url.searchParams.set('studentId',sid);
  url.searchParams.set('loginVerified',sid);
  url.searchParams.set('loginRoute','r53');

  if(ctx.enabled){
    url.searchParams.set('authority','firebase');
    url.searchParams.set('firebaseReady','1');
    if(validFirebaseReceipt())url.searchParams.set('firebaseReceipt','1');
    if(ctx.uid)url.searchParams.set('firebaseUid',ctx.uid);
  }

  try{history.replaceState(history.state,'',url.href)}
  catch(_){return false}

  if((previousSid&&previousSid!==sid)||(previousStudentId&&previousStudentId!==sid)){
    console.info('[Profile Route R53] stale learner route replaced',{previousSid,previousStudentId,studentId:sid});
  }
  return true;
}
function preservePendingProfile(profile){
  const sid=clean(profile?.studentId);
  if(!sid)return false;
  const current=readState();
  const next={
    ...current,
    profile:null,
    pendingProfile:{...profile,studentId:sid},
    view:'student',
    loginRouteGuard:RELEASE,
    loginRoutePreparedAt:new Date().toISOString()
  };
  if(firebaseContext().enabled){
    next.authorityMode='firebase';
    next.firebaseAuthority={...(current.firebaseAuthority||{}),mode:'firebase',uid:firebaseContext().uid||current.firebaseAuthority?.uid||''};
  }
  return writeState(next);
}
function wrapConfirmLogin(){
  if(!window.HH||typeof window.HH.confirmLogin!=='function')return false;
  if(window.HH.confirmLogin.__hhProfileRouteR53===true)return true;
  const original=window.HH.confirmLogin.bind(window.HH);
  const wrapped=function(...args){
    const state=readState();
    const pending=state?.pendingProfile;
    const sid=clean(pending?.studentId);
    if(!sid){toast('ไม่พบข้อมูลนักเรียนที่รอยืนยัน กรุณากรอกรหัสอีกครั้ง');return;}
    preservePendingProfile(pending);
    alignRoute(sid);
    return original(...args);
  };
  wrapped.__hhProfileRouteR53=true;
  wrapped.__hhProfileRouteOriginal=original;
  window.HH.confirmLogin=wrapped;
  window.HH.__profileConfirmRouteGuardR53=RELEASE;
  return true;
}
function stabilizePendingRoute(){
  if(recoverFirebaseRoute())return;
  const state=readState();
  const sid=clean(state?.pendingProfile?.studentId);
  if(sid)alignRoute(sid);
}
function install(){
  installAttempts++;
  stabilizePendingRoute();
  wrapConfirmLogin();
  if(installAttempts>240)clearInterval(installTimer);
}

if(!recoverFirebaseRoute()){
  install();
  installTimer=setInterval(install,100);
  addEventListener('pageshow',install);
  addEventListener('focus',install);
}

window.HHProfileConfirmRouteGuardR53={version:RELEASE,alignRoute,stabilizePendingRoute,wrapConfirmLogin,recoverFirebaseRoute,validFirebaseReceipt};
})();
