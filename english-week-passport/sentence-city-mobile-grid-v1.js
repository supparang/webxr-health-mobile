/* Sentence City • Mobile Uniform Grid V2
 * Keeps every sentence slot and every word choice the same size.
 */
(function(){
  'use strict';

  const VERSION='2026-08-08-SC-MOBILE-UNIFORM-GRID-V2';
  const style=document.createElement('style');
  style.id='scMobileGridStyle';
  style.textContent=`
@media (max-width:720px){
  #mission .board{
    gap:4px!important;
  }
  #mission .slots,
  #mission .depot{
    display:flex!important;
    flex-wrap:nowrap!important;
    gap:6px!important;
    padding:0 2px!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    justify-content:flex-start!important;
    scrollbar-width:none!important;
  }
  #mission .slots::-webkit-scrollbar,
  #mission .depot::-webkit-scrollbar{display:none!important}

  /* Hard geometry contract: slots and draggable choices are identical. */
  #mission .slots > *,
  #mission .depot > *,
  #mission .slot,
  #mission .word,
  #mission .depot button,
  #mission .depot [draggable="true"]{
    box-sizing:border-box!important;
    flex:0 0 104px!important;
    width:104px!important;
    min-width:104px!important;
    max-width:104px!important;
    height:44px!important;
    min-height:44px!important;
    max-height:44px!important;
    padding:5px 7px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    text-align:center!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    line-height:1.05!important;
    font-size:clamp(.58rem,2.55vw,.72rem)!important;
  }
  #mission .control{margin-top:1px!important}
}
@media (max-width:390px){
  #mission .slots > *,
  #mission .depot > *,
  #mission .slot,
  #mission .word,
  #mission .depot button,
  #mission .depot [draggable="true"]{
    flex-basis:88px!important;
    width:88px!important;
    min-width:88px!important;
    max-width:88px!important;
    height:42px!important;
    min-height:42px!important;
    max-height:42px!important;
    padding:4px 5px!important;
    font-size:.58rem!important;
  }
}
`;
  document.head.appendChild(style);

  function applyGrid(){
    const mission=document.getElementById('mission');
    const slots=document.getElementById('slots');
    const depot=document.getElementById('depot');
    if(!mission||!slots||!depot)return;
    mission.classList.add('sc-uniform-tokens');
    mission.dataset.slotCount=String(slots.children.length);
    mission.dataset.wordCount=String(depot.children.length);
  }

  const observer=new MutationObserver(applyGrid);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  applyGrid();

  window.SENTENCE_CITY_MOBILE_GRID={version:VERSION,apply:applyGrid};
})();
