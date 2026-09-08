(()=>{
'use strict';
const RELEASE='20260908-BALANCE-CLASSROOM-RUNTIME-LOADER-V68-GRADE5-FAIR';
const q=new URLSearchParams(location.search);
const directSmoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))&&String(q.get('balanceRoute')||'').startsWith('direct-smoke');
function load(src,id,onload){if(document.getElementById(id)){onload?.();return}const script=document.createElement('script');script.id=id;script.src=src;script.async=false;if(onload)script.onload=onload;script.onerror=()=>{console.error('[BalanceHold V68 physical] failed to load',src);onload?.()};document.head.appendChild(script)}
if(directSmoke){document.documentElement.dataset.bhLegacyStack='skipped-direct-smoke-v68-physical';console.info('[BalanceHold] legacy runtime stack skipped for direct smoke',RELEASE);return}
function loadFirebaseDirectReceipt(){load('./bh-firebase-direct-receipt-v66.js?v=20260908-v66','bh-firebase-direct-receipt-v66')}
function loadSixthPoseRecovery(){load('./bh-final-sixth-pose-recovery-v67.js?v=20260908-v67','bh-final-sixth-pose-recovery-v67',loadFirebaseDirectReceipt)}
function loadCanonicalSummaryUi(){load('./bh-summary-ui-canonical-v57.js?v=20260818-v57','bh-summary-ui-canonical-v57',loadSixthPoseRecovery)}
function loadSummaryGuard(){load('./bh-classroom-summary-passport-v56.js?v=20260818-balance-v65-physical','bh-summary-passport-v56',loadCanonicalSummaryUi)}
function loadPerformance(){const has=[...document.scripts].some(s=>String(s.src||'').includes('bh-classroom-performance-watchdog-v41.js'));if(has)loadSummaryGuard();else load('./bh-classroom-performance-watchdog-v41.js?v=20260818-balance-v65-physical','bh-performance-v65-physical',loadSummaryGuard)}
function loadBalancedPolicy(){load('./bh-classroom-balanced-detection-v55.js?v=20260818-v55-physical','bh-balanced-detection-v55-physical',loadPerformance)}
load('./bh-classroom-boss-detect-v53.js?v=20260818-boss-fair-v55-physical','bh-boss-detect-v55-physical',loadBalancedPolicy);

// This loader runs before the Grade-5 coach script included by the physical page.
// Poll until that coach has wrapped BH.evaluatePose, then install the final mobile-fair
// detector so later wrappers cannot re-impose Safe/Control as hard completion gates.
let fairPatchTimer=0,fairPatchTries=0;
fairPatchTimer=setInterval(()=>{
  fairPatchTries++;
  if(window.HH_BALANCE_GRADE5_FAIR_COACH){
    clearInterval(fairPatchTimer);
    load('./bh-grade5-final-detection-override-v68.js?v=20260908-v68','bh-grade5-final-detection-v68');
  }else if(fairPatchTries>160){
    clearInterval(fairPatchTimer);
    console.warn('[BalanceHold V68] Grade-5 fair coach not observed before timeout');
  }
},50);
addEventListener('pagehide',()=>clearInterval(fairPatchTimer),{once:true});
console.info('[BalanceHold] Classroom V68 physical runtime loader ready',RELEASE);
})();