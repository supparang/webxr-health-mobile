/* Sentence City • Mobile Four-Part Grid V1
 * Shows all sentence slots and word choices without horizontal clipping.
 */
(function(){
  'use strict';

  const VERSION='2026-08-06-SC-MOBILE-GRID-V1';
  const style=document.createElement('style');
  style.id='scMobileGridStyle';
  style.textContent=`
@media (max-width:720px){
  #mission.sc-grid-2x2 .board{
    grid-template-rows:12px minmax(82px,auto) 12px minmax(88px,auto) 44px!important;
    gap:4px!important;
    overflow:visible!important;
  }
  #mission.sc-grid-2x2 .slots,
  #mission.sc-grid-2x2 .depot{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-auto-rows:minmax(40px,auto)!important;
    gap:6px!important;
    padding:0 2px!important;
    overflow:visible!important;
    justify-content:stretch!important;
  }
  #mission.sc-grid-2x2 .slot,
  #mission.sc-grid-2x2 .word{
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:auto!important;
    min-height:40px!important;
    padding:6px 7px!important;
    white-space:normal!important;
    overflow-wrap:anywhere!important;
    line-height:1.08!important;
    font-size:clamp(.62rem,2.7vw,.74rem)!important;
  }
  #mission.sc-grid-2x2 .word{min-height:44px!important}
  #mission.sc-grid-2x2 .control{margin-top:1px!important}
}
@media (max-width:720px) and (max-height:760px){
  #mission.sc-grid-2x2 .board{
    grid-template-rows:10px minmax(72px,auto) 10px minmax(76px,auto) 38px!important;
    gap:3px!important;
  }
  #mission.sc-grid-2x2 .slot,
  #mission.sc-grid-2x2 .word{
    min-height:36px!important;
    padding:4px 6px!important;
    font-size:.6rem!important;
  }
}
`;
  document.head.appendChild(style);

  function applyGrid(){
    const mission=document.getElementById('mission');
    const slots=document.getElementById('slots');
    const depot=document.getElementById('depot');
    if(!mission||!slots||!depot)return;

    const slotCount=slots.children.length;
    const wordCount=depot.children.length;
    const needsGrid=slotCount>=4||wordCount>=4;
    mission.classList.toggle('sc-grid-2x2',needsGrid);
    mission.dataset.slotCount=String(slotCount);
    mission.dataset.wordCount=String(wordCount);
  }

  const observer=new MutationObserver(applyGrid);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  applyGrid();

  window.SENTENCE_CITY_MOBILE_GRID={version:VERSION,apply:applyGrid};
})();
