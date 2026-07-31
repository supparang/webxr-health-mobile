(()=>{
'use strict';
const RELEASE='20260731-HANDWASH-SUMMARY-PASSPORT-RETURN-R47';

function findShellWindow(){
  let current=window;
  for(let i=0;i<6;i++){
    try{
      if(/\/HeroHealth_Learning1\/game-shell-authority-r40\.html$/i.test(current.location.pathname||''))return current;
      if(!current.parent||current.parent===current)break;
      current=current.parent;
    }catch(_){break}
  }
  return null;
}

function buildPassportUrl(shell){
  const params=new URLSearchParams(shell.location.search);
  const rawReturn=params.get('return')||'./index.html';
  const url=new URL(rawReturn,shell.location.href);
  const sid=params.get('studentId')||params.get('sid')||params.get('pid')||'';
  if(sid){url.searchParams.set('sid',sid);url.searchParams.set('studentId',sid)}
  url.searchParams.set('authorityRefresh',String(Date.now()));
  url.searchParams.set('failedGame','handwash');
  url.searchParams.set('noUnlock','1');
  url.searchParams.set('autoNext','0');
  url.searchParams.set('returnRelease',RELEASE);
  return url.href;
}

function returnToPassport(){
  const shell=findShellWindow();
  if(!shell){
    console.error('[Handwash Return R47] game shell not found');
    return false;
  }
  try{
    const backButton=shell.document.getElementById('back');
    if(backButton){
      console.info('[Handwash Return R47] delegating to shell back button');
      backButton.click();
      return true;
    }
  }catch(error){console.warn('[Handwash Return R47] shell button unavailable',error)}
  try{
    shell.location.replace(buildPassportUrl(shell));
    return true;
  }catch(error){
    console.error('[Handwash Return R47] passport navigation failed',error);
    return false;
  }
}

function isIncompleteReturn(button){
  const text=String(button?.textContent||'');
  const complete=document.documentElement.dataset.handwashProcedureComplete==='true';
  return !complete||/ไม่ปลดล็อก|ยังไม่ครบ|without unlock/i.test(text);
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#summaryZoneBtn');
  if(!button||!isIncompleteReturn(button))return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  button.disabled=true;
  button.textContent='กำลังกลับ Hero Passport…';
  if(!returnToPassport()){
    button.disabled=false;
    button.textContent='กลับ Hero Passport';
  }
},{capture:true});

document.documentElement.dataset.handwashSummaryReturn=RELEASE;
window.HHHandwashSummaryPassportReturnR47={release:RELEASE,returnToPassport};
console.info('[Handwash Summary Return R47] installed',RELEASE);
})();
