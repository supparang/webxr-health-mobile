(function(){
'use strict';
const VERSION='2026-08-19-EVENT-DAY-LOGIN-SINGLEFLIGHT-R26';
const HARD_TIMEOUT_MS=4500;
const UI_UNLOCK_MS=5500;
const base=window.EW_AUTHORITY;
if(!base){console.warn('[LEXICON X] login singleflight: authority not ready');return;}
const inflight=new Map();
const clean=v=>String(v==null?'':v).trim();
function timeout(label,promise,ms){let t=0;const guard=new Promise((_,reject)=>{t=setTimeout(()=>{const e=new Error(label+'_TIMEOUT');e.code=label+'_TIMEOUT';reject(e);},ms);});return Promise.race([Promise.resolve(promise),guard]).finally(()=>clearTimeout(t));}
function singleFlight(label,fn){return function(){const args=[...arguments];const id=clean(args[0]);const key=label+'::'+id;if(inflight.has(key))return inflight.get(key);const task=timeout(label,Promise.resolve().then(()=>fn.apply(base,args)),HARD_TIMEOUT_MS).finally(()=>inflight.delete(key));inflight.set(key,task);return task;};}
const wrapped={...base};
if(typeof base.profileLookup==='function')wrapped.profileLookup=singleFlight('PROFILE_LOOKUP',base.profileLookup);
if(typeof base.resume==='function')wrapped.resume=singleFlight('RESUME',base.resume);
window.EW_AUTHORITY=Object.freeze(wrapped);

const loading=document.getElementById('loading');
const loadingText=document.getElementById('loadingText');
const toast=document.getElementById('toast');
let unlockTimer=0;
let generation=0;
function submitActive(){return document.documentElement.dataset.ewSubmitActive==='1';}
function restoreLoginButton(){const btn=document.getElementById('loginStartBtn')||document.querySelector('#loginForm button[type="submit"]');if(btn){btn.disabled=false;if(/กำลัง|ตรวจสอบ|รอสักครู่/.test(btn.textContent||''))btn.textContent='ตรวจสอบรหัสและเริ่มภารกิจ';}}
function forceUnlock(message){if(submitActive())return;generation++;clearTimeout(unlockTimer);unlockTimer=0;if(loading){loading.hidden=true;loading.style.pointerEvents='none';loading.removeAttribute('aria-busy');}restoreLoginButton();if(toast){toast.textContent=message||'การเชื่อมต่อใช้เวลานานเกินไป • กรุณากดลองอีกครั้ง';toast.hidden=false;setTimeout(()=>{if(toast.textContent===message)toast.hidden=true;},4200);}window.EW_PASSPORT_MOBILE_RECOVERY?.unlockScroll?.();}
function arm(){if(!loading||loading.hidden||submitActive())return;generation++;const token=generation;clearTimeout(unlockTimer);unlockTimer=setTimeout(()=>{if(token!==generation||loading.hidden||submitActive())return;forceUnlock('Firebase ตอบช้าเกินกำหนด • กรุณากดลองอีกครั้ง');},UI_UNLOCK_MS);}
if(loading){new MutationObserver(()=>{if(loading.hidden){generation++;clearTimeout(unlockTimer);unlockTimer=0;loading.style.pointerEvents='none';}else{loading.style.pointerEvents='auto';arm();}}).observe(loading,{attributes:true,attributeFilter:['hidden']});}
document.addEventListener('submit',event=>{if(event.target?.id==='loginForm')arm();},true);
window.addEventListener('pageshow',()=>{if(loading&&!loading.hidden)arm();});
window.addEventListener('focus',()=>{if(loading&&!loading.hidden)arm();});
window.EW_EVENT_DAY_LOGIN_GUARD=Object.freeze({version:VERSION,hardTimeoutMs:HARD_TIMEOUT_MS,uiUnlockMs:UI_UNLOCK_MS,inflightCount:()=>inflight.size,forceUnlock});
}());