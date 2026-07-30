(()=>{
'use strict';
const VERSION='20260730-ASSESSMENT-AUTHORITY-WATCHER-V5';
const STATE_KEY='herohealth_learning_platform_rc2';
const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec';
const ENDPOINT=String(window.HH_CONFIG?.assessmentApiUrl||window.HH_CONFIG?.backend?.webAppUrl||DEFAULT_ENDPOINT).trim();
const read=(key,fallback=null)=>{try{const value=localStorage.getItem(key);return value==null?fallback:JSON.parse(value)}catch(_){return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
const clean=value=>String(value==null?'':value).trim().replace(/\s+/g,'');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let running=false;
let stopped=false;

function jsonp(params,timeout=18000){return new Promise((resolve,reject)=>{
 const callback='HHAW5_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
 const script=document.createElement('script');
 let settled=false;
 const finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);script.onerror=null;try{delete window[callback]}catch(_){}try{script.remove()}catch(_){}error?reject(error):resolve(data)};
 const timer=setTimeout(()=>finish(new Error('authority_timeout')),timeout);
 window[callback]=data=>finish(null,data);
 script.onerror=()=>finish(new Error('authority_load_failed'));
 script.async=true;
 script.referrerPolicy='no-referrer';
 script.src=ENDPOINT+'?'+new URLSearchParams({...params,callback,_:String(Date.now()),clientVersion:VERSION}).toString();
 (document.head||document.body||document.documentElement).appendChild(script);
})}

function scoreExists(scores,key){
 if(!scores||!Object.prototype.hasOwnProperty.call(scores,key))return false;
 const value=scores[key];
 const normalized=typeof value==='object'?(value.score??value.value??value.percent):value;
 return normalized!==null&&normalized!==undefined&&normalized!==''&&Number.isFinite(Number(normalized));
}

function isConfirmed(api,task){
 if(!api||api.ok!==true)return false;
 const authority=api.authoritativeState||api;
 const completed=authority.completed||api.completed||{};
 const scores=authority.scores||api.scores||{};
 return completed[task]===true||scoreExists(scores,task);
}

function apply(api,task,sid){
 const authority=api.authoritativeState||api;
 const state=read(STATE_KEY,{})||{};
 state.completed={...(state.completed||{}),...(authority.completed||api.completed||{})};
 state.scores={...(state.scores||{}),...(authority.scores||api.scores||{})};
 state.completed[task]=true;
 state.profile={...(state.profile||{}),...(authority.profile||api.profile||{}),studentId:sid};
 state.gameCompleted=authority.gameCompleted||api.gameCompleted||state.gameCompleted||{hygiene:{},nutrition:{},fitness:{}};
 state.authoritativeProgress=authority.progress||api.progress||state.authoritativeProgress||null;
 state.sheetAuthority=true;
 state.pendingAssessmentAuthority=null;
 state.lastAssessmentAuthorityWatcher={task,studentId:sid,confirmedAt:new Date().toISOString(),version:VERSION};
 write(STATE_KEY,state);
 document.getElementById('hh-assessment-authority-wait')?.remove();
 return state;
}

function refreshClean(){
 const url=new URL(location.href);
 ['hhReturn','task','form','assessmentVersion','sheetSync','attemptId','score'].forEach(key=>url.searchParams.delete(key));
 url.searchParams.set('authorityRefresh',String(Date.now()));
 url.searchParams.set('v','20260730-assessment-authority-watcher-v5');
 location.replace(url.href);
}

async function run(){
 if(running||stopped)return false;
 const state=read(STATE_KEY,{})||{};
 const pending=state.pendingAssessmentAuthority;
 const sid=clean(pending?.studentId||state.profile?.studentId);
 const task=String(pending?.task||'');
 if(!sid||!['pretest','posttest'].includes(task))return false;
 running=true;
 try{
  if(navigator.onLine===false)return false;
  const api=await jsonp({action:'student',studentId:sid,reconcile:'1',force:'1'},18000);
  if(!isConfirmed(api,task))return false;
  stopped=true;
  apply(api,task,sid);
  setTimeout(refreshClean,250);
  return true;
 }catch(error){
  console.warn('[Assessment Authority Watcher V5]',error);
  return false;
 }finally{
  running=false;
 }
}

async function loop(){
 while(!stopped){
  await sleep(3500);
  await run();
  const state=read(STATE_KEY,{})||{};
  if(!state.pendingAssessmentAuthority)break;
 }
}

window.HHAssessmentAuthorityRecovery={run,version:VERSION};
setTimeout(()=>{run();loop()},1800);
addEventListener('online',run);
addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run()});
})();