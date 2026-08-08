(()=>{
'use strict';
const RELEASE='20260808-BALANCE-CLASSROOM-LOADER-V56-STRICT-COMPLETION';
function load(src,id,onload){
  if(document.getElementById(id)){onload?.();return}
  const script=document.createElement('script');
  script.id=id;script.src=src;script.async=false;
  if(onload)script.onload=onload;
  script.onerror=()=>{console.error('[BalanceHold V56] failed to load',src);onload?.()};
  document.head.appendChild(script);
}
function loadSummaryGuard(){
  load('./bh-classroom-summary-passport-v56.js?v=20260808-balance-v56-strict','bh-summary-passport-v56');
}
function loadPerformance(){
  const hasPerformance=[...document.scripts].some(script=>String(script.src||'').includes('bh-classroom-performance-watchdog-v41.js'));
  if(hasPerformance)loadSummaryGuard();
  else load('./bh-classroom-performance-watchdog-v41.js?v=20260808-balance-v56','bh-performance-v56',loadSummaryGuard);
}
function loadBalancedPolicy(){
  load('./bh-classroom-balanced-detection-v54.js?v=20260808-balance-v56','bh-balanced-detection-v56',loadPerformance);
}
load('./bh-classroom-boss-detect-v53.js?v=20260808-balance-v56','bh-boss-detect-v56',loadBalancedPolicy);
console.info('[BalanceHold] Classroom V56 strict completion loader ready',RELEASE);
})();