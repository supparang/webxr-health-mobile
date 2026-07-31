(()=>{
'use strict';

const RELEASE='20260731-PROFILE-CONFIRM-ROUTE-GUARD-R42';
const STATE_KEY='herohealth_learning_platform_rc2';
let installTimer=0;
let installAttempts=0;

const clean=value=>String(value==null?'':value).trim().replace(/\s+/g,'');
function readState(){
  try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}
  catch(_){return{}}
}
function writeState(value){
  try{localStorage.setItem(STATE_KEY,JSON.stringify(value));return true}
  catch(error){console.error('[Profile Route R42] state write failed',error);return false}
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
  const url=new URL(location.href);
  const previousSid=clean(url.searchParams.get('sid'));
  const previousStudentId=clean(url.searchParams.get('studentId'));

  // Remove stale identity and return flags from the previous learner before login reload.
  ['sid','studentId','authorityApplied','authorityRefresh','gameSync','autoNext','pendingGameSync',
   'confirmedNext','fromGame','completedGame','plannerReturn'].forEach(key=>url.searchParams.delete(key));
  url.searchParams.set('sid',sid);
  url.searchParams.set('studentId',sid);
  url.searchParams.set('loginVerified',sid);
  url.searchParams.set('loginRoute','r42');

  try{history.replaceState(history.state,'',url.href)}
  catch(_){return false}

  if((previousSid&&previousSid!==sid)||(previousStudentId&&previousStudentId!==sid)){
    console.info('[Profile Route R42] stale learner route replaced',{
      previousSid,previousStudentId,studentId:sid
    });
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
  return writeState(next);
}
function wrapConfirmLogin(){
  if(!window.HH||typeof window.HH.confirmLogin!=='function')return false;
  if(window.HH.confirmLogin.__hhProfileRouteR42===true)return true;

  const original=window.HH.confirmLogin.bind(window.HH);
  const wrapped=function(...args){
    const state=readState();
    const pending=state?.pendingProfile;
    const sid=clean(pending?.studentId);
    if(!sid){
      toast('ไม่พบข้อมูลนักเรียนที่รอยืนยัน กรุณากรอกรหัสอีกครั้ง');
      return;
    }
    preservePendingProfile(pending);
    alignRoute(sid);
    return original(...args);
  };
  wrapped.__hhProfileRouteR42=true;
  wrapped.__hhProfileRouteOriginal=original;
  window.HH.confirmLogin=wrapped;
  window.HH.__profileConfirmRouteGuardR42=RELEASE;
  return true;
}
function stabilizePendingRoute(){
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

install();
installTimer=setInterval(install,100);
addEventListener('pageshow',install);
addEventListener('focus',install);

window.HHProfileConfirmRouteGuardR42={
  version:RELEASE,
  alignRoute,
  stabilizePendingRoute,
  wrapConfirmLogin
};
})();
