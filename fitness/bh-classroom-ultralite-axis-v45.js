(()=>{
'use strict';
const RELEASE='20260808-BALANCE-CLASSROOM-LOADER-V54.1-BALANCED';
function load(src,id,onload){
  if(document.getElementById(id)){onload?.();return}
  const script=document.createElement('script');
  script.id=id;script.src=src;script.async=false;
  if(onload)script.onload=onload;
  script.onerror=()=>{console.error('[BalanceHold V54.1] failed to load',src);onload?.()};
  document.head.appendChild(script);
}
function loadSummaryGuard(){
  load('./bh-classroom-summary-passport-v50.js?v=20260808-balance-v54-1','bh-summary-passport-v54-1');
}
function loadPerformance(){
  const hasPerformance=[...document.scripts].some(script=>String(script.src||'').includes('bh-classroom-performance-watchdog-v41.js'));
  if(hasPerformance)loadSummaryGuard();
  else load('./bh-classroom-performance-watchdog-v41.js?v=20260808-balance-v54-1','bh-performance-v54-1',loadSummaryGuard);
}
function loadBalancedPolicy(){
  load('./bh-classroom-balanced-detection-v54.js?v=20260808-balance-v54-1','bh-balanced-detection-v54',loadPerformance);
}
load('./bh-classroom-boss-detect-v53.js?v=20260808-balance-v54-1','bh-boss-detect-v54-1',loadBalancedPolicy);
console.info('[BalanceHold] Classroom V54.1 balanced loader ready',RELEASE);
})();