(()=>{
'use strict';
const RELEASE='20260731-BALANCE-CLASSROOM-LOADER-V53';
function load(src,id,onload){
  if(document.getElementById(id)){onload?.();return}
  const script=document.createElement('script');
  script.id=id;script.src=src;script.async=false;
  if(onload)script.onload=onload;
  script.onerror=()=>{console.error('[BalanceHold V53] failed to load',src);onload?.()};
  document.head.appendChild(script);
}
function loadSummaryGuard(){
  load('./bh-classroom-summary-passport-v50.js?v=20260731.53','bh-summary-passport-v53');
}
function loadPerformance(){
  const hasPerformance=[...document.scripts].some(script=>String(script.src||'').includes('bh-classroom-performance-watchdog-v41.js'));
  if(hasPerformance)loadSummaryGuard();
  else load('./bh-classroom-performance-watchdog-v41.js?v=20260731.53','bh-performance-v53',loadSummaryGuard);
}
load('./bh-classroom-boss-detect-v53.js?v=20260731.53','bh-boss-detect-v53',loadPerformance);
console.info('[BalanceHold] Classroom V53 loader ready',RELEASE);
})();