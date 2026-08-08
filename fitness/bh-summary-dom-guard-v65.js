(()=>{
'use strict';
const BH=window.BH;
if(!BH?.state||!BH?.el)return;
if(window.BH_SUMMARY_DOM_GUARD_V65)return;
const RELEASE='20260808-BALANCE-SUMMARY-DOM-GUARD-V65';
const e=BH.el;
const map={
 pauseBtn:'pauseBtn',resultOverlay:'resultOverlay',startOverlay:'startOverlay',
 calibrationOverlay:'calibrationOverlay',hudTime:'hudTime',hudScore:'hudScore',hudPose:'hudPose',
 hudConfidence:'hudConfidence',hudStability:'hudStability',hudTracking:'hudTracking'
};
function repair(){
 for(const [key,id] of Object.entries(map)){
  if(!e[key])e[key]=document.getElementById(id)||null;
 }
 // bh-twin-results-v11 writes pauseBtn unguarded; use a harmless sink only if the DOM node truly does not exist.
 if(!e.pauseBtn)e.pauseBtn={textContent:''};
 return !!e.resultOverlay;
}
repair();
const observer=new MutationObserver(()=>repair());
observer.observe(document.documentElement,{childList:true,subtree:true});
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
window.BH_SUMMARY_DOM_GUARD_V65={release:RELEASE,repair};
document.documentElement.dataset.bhSummaryDomGuard='v65';
console.info('[BalanceHold] Summary DOM Guard V65 ready',RELEASE);
})();
