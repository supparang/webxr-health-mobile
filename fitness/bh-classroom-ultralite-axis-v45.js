(()=>{
'use strict';
const RELEASE='20260731-BALANCE-CLASSROOM-LOADER-V51';
function load(src,id,onload){
  if(document.getElementById(id)){onload?.();return}
  const script=document.createElement('script');
  script.id=id;script.src=src;script.async=false;
  if(onload)script.onload=onload;
  script.onerror=()=>console.error('[BalanceHold V51] failed to load',src);
  document.head.appendChild(script);
}
function loadSummaryGuard(){
  load('./bh-classroom-summary-passport-v50.js?v=20260731.51','bh-summary-passport-v51');
}
const hasPerformance=[...document.scripts].some(script=>String(script.src||'').includes('bh-classroom-performance-watchdog-v41.js'));
if(hasPerformance)loadSummaryGuard();
else load('./bh-classroom-performance-watchdog-v41.js?v=20260731.51','bh-performance-v51',loadSummaryGuard);
console.info('[BalanceHold] Classroom V51 loader ready',RELEASE);
})();