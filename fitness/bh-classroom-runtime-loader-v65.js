(()=>{
'use strict';
const RELEASE='20260818-BALANCE-CLASSROOM-RUNTIME-LOADER-V65-PHYSICAL-SUMMARY-V57';
const q=new URLSearchParams(location.search);
const directSmoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))&&String(q.get('balanceRoute')||'').startsWith('direct-smoke');
function load(src,id,onload){if(document.getElementById(id)){onload?.();return}const script=document.createElement('script');script.id=id;script.src=src;script.async=false;if(onload)script.onload=onload;script.onerror=()=>{console.error('[BalanceHold V65 physical] failed to load',src);onload?.()};document.head.appendChild(script)}
if(directSmoke){document.documentElement.dataset.bhLegacyStack='skipped-direct-smoke-v65-physical';console.info('[BalanceHold] legacy runtime stack skipped for direct smoke',RELEASE);return}
function loadCanonicalSummaryUi(){load('./bh-summary-ui-canonical-v57.js?v=20260818-v57','bh-summary-ui-canonical-v57')}
function loadSummaryGuard(){load('./bh-classroom-summary-passport-v56.js?v=20260818-balance-v65-physical','bh-summary-passport-v56',loadCanonicalSummaryUi)}
function loadPerformance(){const has=[...document.scripts].some(s=>String(s.src||'').includes('bh-classroom-performance-watchdog-v41.js'));if(has)loadSummaryGuard();else load('./bh-classroom-performance-watchdog-v41.js?v=20260818-balance-v65-physical','bh-performance-v65-physical',loadSummaryGuard)}
function loadBalancedPolicy(){load('./bh-classroom-balanced-detection-v55.js?v=20260818-v55-physical','bh-balanced-detection-v55-physical',loadPerformance)}
load('./bh-classroom-boss-detect-v53.js?v=20260818-boss-fair-v55-physical','bh-boss-detect-v55-physical',loadBalancedPolicy);
console.info('[BalanceHold] Classroom V65 physical runtime loader ready',RELEASE);
})();