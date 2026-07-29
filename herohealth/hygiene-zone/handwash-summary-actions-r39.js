(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-SUMMARY-NONOVERLAY-ACTIONS-R39';
const style=document.createElement('style');
style.id='handwashSummaryActionsR39';
style.textContent=`
#summaryOverlay.show{
 scroll-padding-bottom:calc(28px + env(safe-area-inset-bottom,0px))!important;
 padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))!important;
}
#summaryOverlay .card{
 padding-bottom:calc(28px + env(safe-area-inset-bottom,0px))!important;
}
#summaryOverlay .actions{
 position:static!important;
 inset:auto!important;
 z-index:auto!important;
 display:grid!important;
 grid-template-columns:1fr!important;
 gap:10px!important;
 width:100%!important;
 margin:16px 0 0!important;
 padding:0 0 calc(8px + env(safe-area-inset-bottom,0px))!important;
 background:none!important;
 backdrop-filter:none!important;
 box-shadow:none!important;
 transform:none!important;
}
#summaryOverlay .actions::before{
 content:'เลือกหลังจากตรวจผลครบทุกขั้นแล้ว';
 display:block;
 padding:9px 11px;
 border-radius:12px;
 color:#b9dbe7;
 background:rgba(1,14,23,.72);
 font-size:11px;
 font-weight:900;
 line-height:1.4;
 text-align:center;
}
#summaryOverlay .bigbtn{
 position:relative!important;
 width:100%!important;
 min-height:58px!important;
 margin:0!important;
 padding:11px 14px!important;
 border-radius:16px!important;
 font-size:clamp(17px,5vw,21px)!important;
 line-height:1.25!important;
 white-space:normal!important;
 overflow-wrap:anywhere!important;
 transform:none!important;
}
#handwashMissingStepsR32,
#handwashStrictAuditR30,
#summaryOverlay .result-list,
#summaryOverlay .delivery{
 position:relative!important;
 z-index:1!important;
 max-height:none!important;
 overflow:visible!important;
}
#handwashMissingStepsR32{
 margin-bottom:12px!important;
}
#summaryOverlay .result-list{
 padding-bottom:4px!important;
}
#summaryOverlay .delivery{
 margin:12px 0!important;
}
@media(max-width:430px){
 #summaryOverlay .card{padding-bottom:calc(34px + env(safe-area-inset-bottom,0px))!important}
 #summaryOverlay .actions{margin-top:14px!important;padding-bottom:calc(14px + env(safe-area-inset-bottom,0px))!important}
 #summaryOverlay .bigbtn{min-height:60px!important;font-size:18px!important}
}
`;
document.head.appendChild(style);
function normalize(){
 const overlay=document.getElementById('summaryOverlay');
 const actions=overlay?.querySelector('.actions');
 if(!overlay||!actions)return;
 actions.dataset.summaryActions='R39';
 const buttons=[...actions.querySelectorAll('button')];
 buttons.forEach(button=>{button.style.position='relative';button.style.inset='auto';});
 document.documentElement.dataset.handwashSummaryActions=RELEASE;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalize,{once:true});else normalize();
window.addEventListener('herohealth:game-result',()=>setTimeout(normalize,0));
console.info('[Handwash Summary R39] non-overlay actions installed');
})();