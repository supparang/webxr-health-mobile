(()=>{
'use strict';
const RELEASE='20260808-BALANCE-CLASSROOM-LOADER-V63-SINGLE-RUNTIME';
const q=new URLSearchParams(location.search);
const directSmoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))&&String(q.get('balanceRoute')||'').startsWith('direct-smoke');
function load(src,id,onload){
  if(document.getElementById(id)){onload?.();return}
  const script=document.createElement('script');script.id=id;script.src=src;script.async=false;
  if(onload)script.onload=onload;script.onerror=()=>{console.error('[BalanceHold V63] failed to load',src);onload?.()};
  document.head.appendChild(script);
}
if(directSmoke){
  // Direct Smoke owns evaluator/summary/runtime from the outer V63 wrapper.
  // Do not stack the older boss/balanced/performance/summary wrappers again.
  document.documentElement.dataset.bhLegacyStack='skipped-direct-smoke-v63';
  console.info('[BalanceHold] legacy runtime stack skipped for direct smoke',RELEASE);
  return;
}
function loadSummaryGuard(){load('./bh-classroom-summary-passport-v56.js?v=20260808-balance-v63','bh-summary-passport-v56')}
function loadPerformance(){const has=[...document.scripts].some(s=>String(s.src||'').includes('bh-classroom-performance-watchdog-v41.js'));if(has)loadSummaryGuard();else load('./bh-classroom-performance-watchdog-v41.js?v=20260808-balance-v63','bh-performance-v63',loadSummaryGuard)}
function loadBalancedPolicy(){load('./bh-classroom-balanced-detection-v54.js?v=20260808-balance-v63','bh-balanced-detection-v63',loadPerformance)}
load('./bh-classroom-boss-detect-v53.js?v=20260808-balance-v63','bh-boss-detect-v63',loadBalancedPolicy);
console.info('[BalanceHold] Classroom V63 single-runtime loader ready',RELEASE);
})();