(()=>{'use strict';
const VERSION='v7.2.7';
const U='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
const inflight=window.__AIQUEST_JSONP_INFLIGHT__=window.__AIQUEST_JSONP_INFLIGHT__||new Map();
const post=(kind,payload)=>fetch(U,{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'sync_v23',kind,payload:{...payload,section:'101',clientTs:payload?.clientTs||new Date().toISOString(),pageUrl:payload?.pageUrl||location.href}})}).then(()=>({ok:true,queued:true}));
const stableKey=(action,params={})=>action+'|'+Object.keys(params).sort().map(k=>k+'='+String(params[k]??'')).join('&');
const keepCallbackTombstone=callback=>{
 try{window[callback]=()=>{}}catch(e){}
 setTimeout(()=>{try{delete window[callback]}catch(e){try{window[callback]=undefined}catch(_){}}},120000);
};
const jsonpOnce=(action,params={},timeoutMs=30000)=>new Promise((resolve,reject)=>{
 const callback='__aiquest_jsonp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10),url=new URL(U),script=document.createElement('script');
 let settled=false,timer=0;
 url.searchParams.set('action',action);url.searchParams.set('callback',callback);url.searchParams.set('_cb',Date.now().toString());
 Object.keys(params).forEach(k=>url.searchParams.set(k,String(params[k]??'')));
 const finish=(ok,value)=>{
  if(settled)return;settled=true;clearTimeout(timer);
  keepCallbackTombstone(callback);
  try{script.remove()}catch(e){}
  ok?resolve(value||{}):reject(value instanceof Error?value:new Error(String(value||action+' failed')));
 };
 window[callback]=data=>finish(true,data);
 script.onerror=()=>finish(false,new Error(action+' unavailable'));
 timer=setTimeout(()=>finish(false,new Error(action+' timeout after '+timeoutMs+'ms')),timeoutMs);
 script.async=true;script.src=url.toString();document.head.appendChild(script);
});
const shared=(action,params,timeoutMs)=>{
 const key=stableKey(action,params);
 if(inflight.has(key))return inflight.get(key);
 const p=jsonpOnce(action,params,timeoutMs).finally(()=>inflight.delete(key));
 inflight.set(key,p);return p;
};
const jsonp=async(action,params={})=>{
 let lastError;
 for(let attempt=1;attempt<=2;attempt++){
  try{return await shared(action,{...params,_attempt:attempt},attempt===1?30000:45000)}
  catch(err){lastError=err;if(attempt<2)await new Promise(r=>setTimeout(r,1200))}
 }
 throw lastError||new Error(action+' failed');
};
const jsonpFast=(action,params={})=>shared(action,params,20000);
const studentIdOf=p=>String(p?.studentId||'').trim();
const sidOf=x=>String(x||'').toLowerCase().replace(/^m/,'s').replace(/^boss/,'b');
const bossPassed=row=>{const id=sidOf(row?.sessionId||row?.missionId||row?.id),score=Number(row?.score||row?.bestScore||0),status=String(row?.gateStatus||row?.status||'').toLowerCase(),win=row?.bossWin===true||String(row?.bossWin).toLowerCase()==='true';if(!/^b[1-5]$/.test(id))return null;if(status==='passed'||status==='mastered'||status==='completed')return true;if(id==='b4')return win&&score>=70;if(id==='b5')return win&&score>=75;return win};
function sanitizeRows(value){if(Array.isArray(value))return value.map(row=>{if(!row||typeof row!=='object')return row;const passed=bossPassed(row);if(passed===null)return {...row};return passed?{...row,passed:true,status:row.status||'passed'}:{...row,passed:false,status:'not-passed',gateStatus:'not-passed',score:0,bestScore:0,stars:0}});if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value)){const id=sidOf(k);if(/^b[1-5]$/.test(id)&&v&&typeof v==='object'){const passed=bossPassed({...v,sessionId:id});out[k]=passed?{...v,passed:true,status:v.status||'passed'}:{...v,passed:false,status:'not-passed',gateStatus:'not-passed',score:0,bestScore:0,stars:0}}else out[k]=v}return out}return value}
function strictProgressResponse(r){if(!r||typeof r!=='object')return r;const out={...r};['progress','missions','summary','attempts'].forEach(k=>{if(k in out)out[k]=sanitizeRows(out[k])});if(out.data&&typeof out.data==='object'){out.data={...out.data};['progress','missions','attempts','summary'].forEach(k=>{if(k in out.data)out.data[k]=sanitizeRows(out.data[k])})}out.bossPassPolicy='B1-B3 require bossWin/passed; B4 bossWin+70; B5 bossWin+75';return out}
const getProfile=async payload=>{const studentId=studentIdOf(payload);if(!studentId)return{ok:false,found:false,error:'studentId is required'};return jsonp('profileLookup',{studentId,section:'101'})};
const getProgress=async payload=>{const studentId=studentIdOf(payload);if(!studentId)return{ok:false,found:false,error:'studentId is required'};return strictProgressResponse(await jsonp('studentProgress',{studentId,section:'101'}))};
const getGate=async payload=>{const studentId=studentIdOf(payload),sessionId=sidOf(payload?.sessionId||payload?.missionId);if(!studentId)return{ok:false,found:false,error:'studentId is required'};if(!sessionId)return{ok:false,found:false,error:'sessionId is required'};return jsonpFast('studentGate',{studentId,sessionId,section:'101'})};
window.AIQuestCloudLogger={version:VERSION,isCloudReady:()=>true,healthCheck:async()=>jsonp('health',{}),sendProfile:p=>post('profile',p),sendAttempt:p=>post('attempt',p),sendEvent:p=>post('event',p),getProfile,getProgress,getGate,flushPending:async()=>({ok:true,queued:true})};
function loadUpperQuality(){if(document.querySelector('script[data-aiquest-upper714]'))return;const s=document.createElement('script');s.src='./js/aiquest-upper-course-quality-v714.js?v=20260714-upper714';s.async=true;s.dataset.aiquestUpper714='1';document.head.appendChild(s)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadUpperQuality,{once:true});else loadUpperQuality();
console.log('[AIQuest] cloud logger v727 ready • safe late JSONP callbacks • shared studentGate request');
})();