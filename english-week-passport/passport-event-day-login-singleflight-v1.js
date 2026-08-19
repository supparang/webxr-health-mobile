(function(){
'use strict';
const VERSION='2026-08-19-EVENT-DAY-LOGIN-SINGLEFLIGHT-R28-HARDSTOP';
const HARD_TIMEOUT_MS=4000;
const LOGIN_UI_HARDSTOP_MS=5500;
const base=window.EW_AUTHORITY;
if(!base){console.warn('[LEXICON X] login singleflight: authority not ready');return;}

const inflight=new Map();
const clean=v=>String(v==null?'':v).trim();
function timeout(label,promise,ms){
  let t=0;
  const guard=new Promise((_,reject)=>{
    t=setTimeout(()=>{const e=new Error(label+'_TIMEOUT');e.code=label+'_TIMEOUT';reject(e);},ms);
  });
  return Promise.race([Promise.resolve(promise),guard]).finally(()=>clearTimeout(t));
}
function singleFlight(label,fn){
  return function(){
    const args=[...arguments];
    const id=clean(args[0]);
    const key=label+'::'+id;
    if(inflight.has(key))return inflight.get(key);
    const task=timeout(label,Promise.resolve().then(()=>fn.apply(base,args)),HARD_TIMEOUT_MS)
      .finally(()=>inflight.delete(key));
    inflight.set(key,task);
    return task;
  };
}
const wrapped={...base};
if(typeof base.profileLookup==='function')wrapped.profileLookup=singleFlight('PROFILE_LOOKUP',base.profileLookup);
if(typeof base.resume==='function')wrapped.resume=singleFlight('RESUME',base.resume);
window.EW_AUTHORITY=Object.freeze(wrapped);

const loading=document.getElementById('loading');
const loadingText=document.getElementById('loadingText');
const toast=document.getElementById('toast');
let visibleSince=0;
let hardStopped=false;

function submitActive(){return document.documentElement.dataset.ewSubmitActive==='1';}
function isLoginLoading(){
  const text=clean(loadingText?.textContent);
  return /ตรวจสอบรหัส|กำลังตรวจสอบ|checking/i.test(text);
}
function restoreLoginButton(){
  const btn=document.getElementById('loginStartBtn')||document.querySelector('#loginForm button[type="submit"]');
  if(btn){
    btn.disabled=false;
    btn.removeAttribute('aria-busy');
    btn.style.pointerEvents='auto';
    btn.textContent='ตรวจสอบรหัสและเริ่มภารกิจ';
  }
}
function hardHideLoading(){
  if(!loading)return;
  loading.hidden=true;
  loading.setAttribute('hidden','');
  loading.style.setProperty('display','none','important');
  loading.style.setProperty('pointer-events','none','important');
  loading.removeAttribute('aria-busy');
}
function forceUnlock(message,force){
  if(!force && submitActive())return;
  hardStopped=true;
  hardHideLoading();
  restoreLoginButton();
  visibleSince=0;
  if(toast){
    toast.textContent=message||'การเชื่อมต่อใช้เวลานานเกินไป • กรุณากดลองอีกครั้ง';
    toast.hidden=false;
  }
  window.EW_PASSPORT_MOBILE_RECOVERY?.unlockScroll?.();
}
function watch(){
  if(!loading)return;
  const visible=!loading.hidden && getComputedStyle(loading).display!=='none';
  if(!visible){visibleSince=0;return;}
  if(!visibleSince)visibleSince=Date.now();
  const elapsed=Date.now()-visibleSince;
  // Login lookup must NEVER leave a blocking spinner on screen beyond 5.5 s,
  // even if another patch accidentally leaves ewSubmitActive=1 or re-arms a timer.
  if(isLoginLoading() && elapsed>=LOGIN_UI_HARDSTOP_MS){
    forceUnlock('เชื่อมต่อ Firebase ไม่สำเร็จภายใน 5 วินาที • กรุณากดตรวจสอบอีกครั้ง',true);
  }
}
if(loading){
  new MutationObserver(()=>{
    if(loading.hidden){visibleSince=0;loading.style.pointerEvents='none';}
    else if(!visibleSince){visibleSince=Date.now();}
  }).observe(loading,{attributes:true,attributeFilter:['hidden','style']});
}
setInterval(watch,250);
document.addEventListener('pointerdown',event=>{
  if(event.target?.id==='loginStartBtn'){
    hardStopped=false;
    visibleSince=Date.now();
    if(loading){loading.style.removeProperty('display');}
  }
},true);
document.addEventListener('click',event=>{
  if(event.target?.id==='loginStartBtn'){
    hardStopped=false;
    if(!visibleSince)visibleSince=Date.now();
  }
},true);
window.EW_EVENT_DAY_LOGIN_GUARD=Object.freeze({
  version:VERSION,
  hardTimeoutMs:HARD_TIMEOUT_MS,
  uiHardStopMs:LOGIN_UI_HARDSTOP_MS,
  inflightCount:()=>inflight.size,
  forceUnlock,
  state:()=>({visibleSince,hardStopped,loginLoading:isLoginLoading()})
});
}());