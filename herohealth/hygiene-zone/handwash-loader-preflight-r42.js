(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-LOADER-PREFLIGHT-R42';
const nativeFetch=window.fetch.bind(window);
const startedAt=Date.now();
let terminal=false;
let loadedParts=0;
const PART_RE=/handwash-who-v4\.part[1-4]\.txt(?:\?|$)/i;

function startButton(){return document.getElementById('startBtn')}
function detectStatus(){return document.getElementById('detectStatus')}
function setButton(text,disabled=true){
 const button=startButton();
 if(!button)return;
 button.textContent=text;
 button.disabled=disabled;
}
function updateProgress(){
 const button=startButton();
 if(button&&document.documentElement.dataset.handwashRuntime!=='ready'){
  button.textContent=loadedParts>0?`กำลังโหลดระบบ ${loadedParts}/4…`:'กำลังเตรียมระบบ…';
  button.disabled=true;
 }
 const status=detectStatus();
 if(status&&document.documentElement.dataset.handwashRuntime!=='ready')status.textContent=`โหลดระบบตรวจมือ ${loadedParts}/4`;
}
function fetchOnce(input,init,timeoutMs){
 const controller=new AbortController();
 const upstream=init?.signal;
 let upstreamAbort;
 if(upstream){
  if(upstream.aborted)controller.abort(upstream.reason);
  else{upstreamAbort=()=>controller.abort(upstream.reason);upstream.addEventListener('abort',upstreamAbort,{once:true});}
 }
 const timeout=setTimeout(()=>controller.abort(new DOMException('handwash_part_timeout','AbortError')),timeoutMs);
 return nativeFetch(input,{...(init||{}),cache:'no-store',signal:controller.signal})
  .finally(()=>{clearTimeout(timeout);if(upstream&&upstreamAbort)upstream.removeEventListener('abort',upstreamAbort)});
}
async function fetchPart(input,init){
 const original=typeof input==='string'?input:String(input?.url||input);
 let lastError;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const url=new URL(original,location.href);
   url.searchParams.set('r42',`${Date.now()}-${attempt}`);
   const response=await fetchOnce(url.href,init,attempt===0?5500:7500);
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   loadedParts=Math.min(4,loadedParts+1);
   updateProgress();
   return response;
  }catch(error){
   lastError=error;
   console.warn('[Handwash Preflight R42] part retry',{original,attempt,error:String(error?.message||error)});
  }
 }
 throw lastError||new Error('handwash_part_load_failed');
}
window.fetch=function(input,init){
 const url=typeof input==='string'?input:String(input?.url||input);
 return PART_RE.test(url)?fetchPart(input,init):nativeFetch(input,init);
};

function manualRecovery(reason){
 if(terminal||document.documentElement.dataset.handwashRuntime==='ready')return;
 terminal=true;
 document.documentElement.dataset.handwashRuntime='failed';
 document.documentElement.dataset.handwashPreflightState='manual-retry';
 const status=detectStatus();if(status)status.textContent='โหลดเกมไม่สำเร็จ • แตะลองใหม่';
 const button=startButton();
 if(button){
  button.disabled=false;
  button.textContent='แตะเพื่อลองโหลดเกมใหม่';
  button.onclick=()=>{
   const url=new URL(location.href);
   url.searchParams.set('loaderRetry',String(Date.now()));
   url.searchParams.set('bootRetry','0');
   location.replace(url.href);
  };
 }
 const toast=document.getElementById('toast');
 if(toast){toast.textContent=`โหลดระบบไม่สำเร็จ (${reason}) • แตะปุ่มเพื่อลองใหม่`;toast.classList.add('show')}
}
function watch(){
 if(terminal)return;
 const state=document.documentElement.dataset.handwashRuntime;
 if(state==='ready'){
  terminal=true;
  document.documentElement.dataset.handwashPreflightState='ready';
  return;
 }
 if(state==='failed'){
  manualRecovery('runtime_failed');
  return;
 }
 const elapsed=Date.now()-startedAt;
 if(elapsed>18000){manualRecovery('timeout_18s');return}
 requestAnimationFrame(watch);
}
document.documentElement.dataset.handwashLoaderPreflight=RELEASE;
document.documentElement.dataset.handwashPreflightState='starting';
updateProgress();
requestAnimationFrame(watch);
console.info('[Handwash Preflight R42] installed before runtime loader');
})();