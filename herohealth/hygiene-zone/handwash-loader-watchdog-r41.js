(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-LOADER-WATCHDOG-R41';
const startedAt=Date.now();
let finished=false;
function button(){return document.getElementById('startBtn')}
function ready(){const b=button();return document.documentElement.dataset.handwashRuntime==='ready'||(b&&typeof b.onclick==='function'&&!/กำลังโหลด|loading/i.test(String(b.textContent||'')))}
function recover(){
 if(finished||ready()){finished=true;document.documentElement.dataset.handwashWatchdog='ready';return}
 const b=button();
 const url=new URL(location.href);
 const retry=Number(url.searchParams.get('bootRetry')||0);
 document.documentElement.dataset.handwashWatchdog='stalled';
 if(retry<1){
  if(b){b.disabled=true;b.textContent='กำลังซ่อมการโหลด…'}
  url.searchParams.set('bootRetry','1');
  url.searchParams.set('bootCv',String(Date.now()));
  setTimeout(()=>location.replace(url.href),350);
  return;
 }
 finished=true;
 if(b){
  b.disabled=false;
  b.textContent='แตะเพื่อลองโหลดเกมใหม่';
  b.onclick=()=>{
   const next=new URL(location.href);
   next.searchParams.set('bootRetry','0');
   next.searchParams.set('bootCv',String(Date.now()));
   location.replace(next.href);
  };
 }
 const status=document.getElementById('detectStatus');
 if(status)status.textContent='โหลดเกมไม่สำเร็จ • แตะลองใหม่';
 document.documentElement.dataset.handwashWatchdog='manual-retry';
}
const timer=setInterval(()=>{
 if(ready()){
  finished=true;clearInterval(timer);document.documentElement.dataset.handwashWatchdog='ready';return;
 }
 if(Date.now()-startedAt>9000){clearInterval(timer);recover()}
},350);
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
document.documentElement.dataset.handwashLoaderWatchdog=RELEASE;
})();