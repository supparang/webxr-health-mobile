/* Sentence City • Summary Mobile Final Pass V1
 * Keeps primary learning results and actions above the fold.
 * Research analytics remain available inside a collapsible details panel.
 */
(function(){
  'use strict';

  const VERSION='2026-08-06-SC-SUMMARY-MOBILE-V1';

  const style=document.createElement('style');
  style.id='scSummaryMobileStyle';
  style.textContent=`
.summary.sc-summary-final{
  justify-content:flex-start!important;
  min-height:0!important;
  gap:8px!important;
  padding-bottom:calc(14px + env(safe-area-inset-bottom))!important;
}
.summary.sc-summary-final .mark{
  font-size:clamp(2rem,8vw,3rem)!important;
  line-height:1!important;
  margin:0!important;
}
.summary.sc-summary-final h1{
  font-size:clamp(1.55rem,7vw,2.15rem)!important;
  line-height:1.05!important;
  margin:0!important;
}
.summary.sc-summary-final h2{
  font-size:clamp(.82rem,3.5vw,1.05rem)!important;
  line-height:1.18!important;
  margin:0!important;
}
.summary.sc-summary-final .banner{
  padding:9px 12px!important;
  font-size:clamp(.78rem,3.5vw,1rem)!important;
  line-height:1.15!important;
}
.summary.sc-summary-final .summary-sky{
  height:clamp(112px,16dvh,145px)!important;
  min-height:112px!important;
}
.summary.sc-summary-final .summary-buildings{
  height:82px!important;
  bottom:10px!important;
}
.summary.sc-summary-final .summary-grid{
  gap:6px!important;
}
.summary.sc-summary-final .summary-grid .stat{
  padding:7px 8px!important;
  border-radius:11px!important;
}
.summary.sc-summary-final .summary-grid .stat small{
  font-size:.58rem!important;
}
.summary.sc-summary-final .summary-grid .stat b{
  font-size:1.02rem!important;
}
.summary.sc-summary-final .learning{
  padding:9px 10px!important;
  border-radius:12px!important;
  font-size:.76rem!important;
  line-height:1.36!important;
}
.summary.sc-summary-final .actions{
  order:20!important;
  display:grid!important;
  grid-template-columns:1fr 1fr!important;
  gap:7px!important;
  width:100%!important;
}
.summary.sc-summary-final .actions .btn{
  min-height:44px!important;
  height:auto!important;
  padding:8px 7px!important;
  border-radius:12px!important;
  font-size:.72rem!important;
  line-height:1.15!important;
}
.summary.sc-summary-final .sc-analytics-details{
  order:30!important;
  width:100%!important;
  border:1px solid #5062ad!important;
  border-radius:13px!important;
  background:#101946!important;
  overflow:hidden!important;
}
.summary.sc-summary-final .sc-analytics-details>summary{
  min-height:42px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:9px 12px!important;
  cursor:pointer!important;
  color:#e8edff!important;
  font-size:.76rem!important;
  font-weight:900!important;
  list-style:none!important;
  user-select:none!important;
}
.summary.sc-summary-final .sc-analytics-details>summary::-webkit-details-marker{display:none!important}
.summary.sc-summary-final .sc-analytics-details>summary:after{
  content:'▾';
  margin-left:8px;
  transition:transform .18s ease;
}
.summary.sc-summary-final .sc-analytics-details[open]>summary:after{transform:rotate(180deg)}
.summary.sc-summary-final .sc-analytics-body{
  display:grid!important;
  gap:7px!important;
  padding:0 8px 9px!important;
}
.summary.sc-summary-final .analytics-grid{
  gap:6px!important;
}
.summary.sc-summary-final .analytics-grid .stat{
  padding:7px 8px!important;
  border-radius:10px!important;
}
.summary.sc-summary-final .analytics-grid .stat small{
  font-size:.52rem!important;
}
.summary.sc-summary-final .analytics-grid .stat b{
  font-size:.86rem!important;
}
.summary.sc-summary-final .notice{
  padding:8px!important;
  border-radius:10px!important;
  font-size:.66rem!important;
  line-height:1.25!important;
}
@media(max-width:720px){
  .panel:has(.summary.sc-summary-final){
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    padding:6px 6px calc(14px + env(safe-area-inset-bottom))!important;
    scroll-padding-bottom:calc(16px + env(safe-area-inset-bottom))!important;
  }
}
@media(max-width:390px), (max-height:760px){
  .summary.sc-summary-final{gap:6px!important}
  .summary.sc-summary-final .mark{font-size:1.75rem!important}
  .summary.sc-summary-final h1{font-size:1.42rem!important}
  .summary.sc-summary-final h2{font-size:.76rem!important}
  .summary.sc-summary-final .summary-sky{height:102px!important;min-height:102px!important}
  .summary.sc-summary-final .summary-buildings{height:70px!important}
  .summary.sc-summary-final .learning{font-size:.7rem!important;padding:7px 8px!important}
  .summary.sc-summary-final .actions .btn{min-height:40px!important;font-size:.67rem!important}
}
`;
  document.head.appendChild(style);

  function enhanceSummary(){
    const summary=document.querySelector('.summary');
    if(!summary||summary.dataset.mobileSummaryFinal==='1')return;

    const analytics=summary.querySelector('.analytics-grid');
    const notice=summary.querySelector('.notice');
    const actions=summary.querySelector('.actions');
    const learning=summary.querySelector('.learning');
    if(!analytics||!actions)return;

    summary.dataset.mobileSummaryFinal='1';
    summary.classList.add('sc-summary-final');

    // Put the primary actions immediately after the learning result.
    if(learning?.nextSibling)summary.insertBefore(actions,learning.nextSibling);
    else summary.appendChild(actions);

    const details=document.createElement('details');
    details.className='sc-analytics-details';
    details.setAttribute('aria-label','รายละเอียดการเล่นและ Learning Analytics');

    const toggle=document.createElement('summary');
    toggle.textContent='ดูรายละเอียดการเล่น';

    const body=document.createElement('div');
    body.className='sc-analytics-body';
    body.appendChild(analytics);
    if(notice)body.appendChild(notice);

    details.append(toggle,body);
    summary.appendChild(details);

    details.addEventListener('toggle',()=>{
      toggle.textContent=details.open?'ซ่อนรายละเอียดการเล่น':'ดูรายละเอียดการเล่น';
      if(details.open){
        requestAnimationFrame(()=>details.scrollIntoView({behavior:'smooth',block:'nearest'}));
      }
    });

    const panel=summary.closest('.panel');
    if(panel)panel.scrollTop=0;
  }

  const observer=new MutationObserver(enhanceSummary);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhanceSummary();

  window.SENTENCE_CITY_SUMMARY_MOBILE={version:VERSION,enhance:enhanceSummary};
})();
