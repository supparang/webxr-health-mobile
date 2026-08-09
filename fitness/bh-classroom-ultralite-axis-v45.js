(()=>{
'use strict';
const RELEASE='20260809-BALANCE-CLASSROOM-LOADER-V64-BOSS-FAIR';
const q=new URLSearchParams(location.search);
const directSmoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))&&String(q.get('balanceRoute')||'').startsWith('direct-smoke');
function load(src,id,onload){
  if(document.getElementById(id)){onload?.();return}
  const script=document.createElement('script');script.id=id;script.src=src;script.async=false;
  if(onload)script.onload=onload;script.onerror=()=>{console.error('[BalanceHold V64] failed to load',src);onload?.()};
  document.head.appendChild(script);
}
if(directSmoke){
  document.documentElement.dataset.bhLegacyStack='skipped-direct-smoke-v64';
  console.info('[BalanceHold] legacy runtime stack skipped for direct smoke',RELEASE);
  return;
}
function loadSummaryGuard(){load('./bh-classroom-summary-passport-v56.js?v=20260809-balance-v64','bh-summary-passport-v56')}
function loadPerformance(){const has=[...document.scripts].some(s=>String(s.src||'').includes('bh-classroom-performance-watchdog-v41.js'));if(has)loadSummaryGuard();else load('./bh-classroom-performance-watchdog-v41.js?v=20260809-balance-v64','bh-performance-v64',loadSummaryGuard)}
function loadBalancedPolicy(){load('./bh-classroom-balanced-detection-v54.js?v=20260809-balance-v64','bh-balanced-detection-v64',loadPerformance)}
load('./bh-classroom-boss-detect-v53.js?v=20260809-boss-fair-v55','bh-boss-detect-v55',loadBalancedPolicy);
console.info('[BalanceHold] Classroom V64 boss-fair runtime loader ready',RELEASE);
})();