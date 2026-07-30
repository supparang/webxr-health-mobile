(()=>{
'use strict';
const VERSION='20260730-ASSESSMENT-RETURN-AUTO-AUTHORITY-V6';
const STATE_KEY='herohealth_learning_platform_rc2';
const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec';
const ENDPOINT=String(window.HH_CONFIG?.assessmentApiUrl||window.HH_CONFIG?.backend?.webAppUrl||DEFAULT_ENDPOINT).trim();
const q=new URLSearchParams(location.search);
const form=String(q.get('form')||'').toUpperCase();
const syncState=String(q.get('sheetSync')||'').toLowerCase();
const synced=['sent','confirmed','pending'].includes(syncState);
const isPre=/^PRE(?:-|$)/.test(form)||q.get('task')==='pretest';
const isPost=/^POST(?:-|$)/.test(form)||q.get('task')==='posttest';
if(!synced||(!isPre&&!isPost))return;

const readJSON=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null')}catch(_){return null}};
const writeJSON=(storage,key,value)=>{try{storage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
const clean=value=>String(value==null?'':value).trim().replace(/\s+/g,'');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function jsonp(params,timeout=18000){
 return new Promise((resolve,reject)=>{
  const callback='HHARV6_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
  const script=document.createElement('script');
  let settled=false;
  const finish=(error,data)=>{
   if(settled)return;
   settled=true;
   clearTimeout(timer);
   script.onerror=null;
   try{delete window[callback]}catch(_){}
   try{script.remove()}catch(_){}
   error?reject(error):resolve(data);
  };
  const timer=setTimeout(()=>finish(new Error('authority_timeout')),timeout);
  window[callback]=data=>finish(null,data);
  script.onerror=()=>finish(new Error('authority_load_failed'));
  script.async=true;
  script.referrerPolicy='no-referrer';
  script.src=ENDPOINT+'?'+new URLSearchParams({...params,callback,_:String(Date.now()),clientVersion:VERSION}).toString();
  (document.head||document.body||document.documentElement).appendChild(script);
 });
}

function overlay(text){
 let box=document.getElementById('hh-assessment-authority-wait');
 if(!box){
  box=document.createElement('div');
  box.id='hh-assessment-authority-wait';
  box.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.9);display:grid;place-items:center;padding:28px;color:#fff;font:800 19px/1.6 system-ui;text-align:center;white-space:pre-line';
  document.body.appendChild(box);
 }
 box.textContent=text;
}

function scoreExists(scores,key){
 if(!scores||!Object.prototype.hasOwnProperty.call(scores,key))return false;
 const value=scores[key];
 return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(typeof value==='object'?(value.score??value.value??value.percent):value));
}

function confirmedByAuthority(api,task){
 if(!api||api.ok!==true)return false;
 const authority=api.authoritativeState||api;
 const completed=authority.completed||api.completed||{};
 const scores=authority.scores||api.scores||{};
 return completed[task]===true||scoreExists(scores,task);
}

function applyAuthority(api,task,sid){
 const authority=api.authoritativeState||api;
 const state=readJSON(localStorage,STATE_KEY)||{};
 state.completed={...(state.completed||{}),...(authority.completed||api.completed||{})};
 state.scores={...(state.scores||{}),...(authority.scores||api.scores||{})};
 state.completed[task]=true;
 state.profile={...(state.profile||{}),...(authority.profile||api.profile||{}),studentId:sid};
 state.gameCompleted=authority.gameCompleted||api.gameCompleted||state.gameCompleted||{hygiene:{},nutrition:{},fitness:{}};
 state.authoritativeProgress=authority.progress||api.progress||state.authoritativeProgress||null;
 state.sheetAuthority=true;
 state.pendingAssessmentAuthority=null;
 state.lastAssessmentAuthorityBridge={task,studentId:sid,confirmedAt:new Date().toISOString(),version:VERSION};
 writeJSON(localStorage,STATE_KEY,state);
 try{
  sessionStorage.setItem('hh_recent_assessment_return:'+sid,String(Date.now()));
  sessionStorage.setItem('hh_assessment_authority_confirmed:'+sid+':'+task,String(Date.now()));
 }catch(_){}
 return state;
}

function cleanReturnUrl(){
 const url=new URL(location.href);
 ['hhReturn','task','form','assessmentVersion','sheetSync','attemptId','score'].forEach(key=>url.searchParams.delete(key));
 url.searchParams.set('authorityRefresh',String(Date.now()));
 url.searchParams.set('v','20260730-assessment-auto-authority-v6');
 return url.href;
}

const initialState=readJSON(localStorage,STATE_KEY)||{};
const profile=initialState.profile||{};
const sid=clean(profile.studentId);
if(!sid)return;
const task=isPre?'pretest':'posttest';
initialState.pendingAssessmentAuthority={task,studentId:sid,source:'assessment-return-auto-watch',createdAt:new Date().toISOString(),version:VERSION};
initialState.sheetAuthority=false;
writeJSON(localStorage,STATE_KEY,initialState);
window.__HH_ASSESSMENT_BRIDGE_PENDING__=true;

let stopped=false;
let attempt=0;
async function checkUntilConfirmed(){
 if(stopped)return;
 attempt++;
 if(navigator.onLine===false){
  overlay('กำลังรออินเทอร์เน็ต\nระบบจะตรวจ Google Sheet และเปิดภารกิจถัดไปให้อัตโนมัติ\nไม่ต้องทำข้อสอบซ้ำ');
  await sleep(2500);
  return checkUntilConfirmed();
 }
 overlay('กำลังตรวจผล '+(isPre?'Pre-test':'Post-test')+' จาก Google Sheet\nระบบจะเปิดภารกิจถัดไปให้อัตโนมัติ\nไม่ต้อง refresh และไม่ต้องทำข้อสอบซ้ำ'+(attempt>1?'\nตรวจสอบครั้งที่ '+attempt:''));
 try{
  const api=await jsonp({action:'student',studentId:sid,reconcile:'1',force:'1'},18000);
  if(confirmedByAuthority(api,task)){
   stopped=true;
   applyAuthority(api,task,sid);
   overlay('✓ Google Sheet ยืนยันแล้ว\nกำลังเปิด Hero Passport…');
   setTimeout(()=>location.replace(cleanReturnUrl()),350);
   return;
  }
  if(attempt%4===0){
   try{await jsonp({action:'reconcileStudent',studentId:sid,force:'1'},18000)}catch(_){}
  }
 }catch(error){
  console.warn('[Assessment Auto Authority V6]',error);
 }
 const delay=Math.min(6000,1200+attempt*350);
 await sleep(delay);
 return checkUntilConfirmed();
}

addEventListener('online',()=>{if(!stopped)checkUntilConfirmed()},{once:true});
checkUntilConfirmed();
})();