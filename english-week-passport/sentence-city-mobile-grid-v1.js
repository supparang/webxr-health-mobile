/* Sentence City • Mobile Uniform Grid V3
 * Every question uses the same 2-column layout for Sentence Blueprint and Word Depot.
 * 3 tokens = 2+1, 4 = 2+2, 5 = 2+2+1.
 */
(function(){
  'use strict';

  const VERSION='2026-08-08-SC-MOBILE-UNIFORM-GRID-V3';
  const style=document.createElement('style');
  style.id='scMobileGridStyle';
  style.textContent=`
@media (max-width:720px){
  #mission .board{
    gap:4px!important;
    overflow-y:auto!important;
    overflow-x:hidden!important;
  }

  /* One visual grammar for every question: always two equal columns. */
  #mission .slots,
  #mission .depot{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-auto-rows:44px!important;
    gap:6px!important;
    width:100%!important;
    max-width:100%!important;
    padding:0 2px!important;
    overflow:visible!important;
    justify-content:stretch!important;
    align-items:stretch!important;
  }

  /* Hard geometry contract: every slot and every draggable choice fills one grid cell. */
  #mission .slots > *,
  #mission .depot > *,
  #mission .slot,
  #mission .word,
  #mission .depot button,
  #mission .depot [draggable="true"]{
    box-sizing:border-box!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:44px!important;
    min-height:44px!important;
    max-height:44px!important;
    margin:0!important;
    padding:5px 7px!important;
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
  #mission .slots,
  #mission .depot{grid-auto-rows:42px!important;gap:5px!important}
  #mission .slots > *,
  #mission .depot > *,
  #mission .slot,
  #mission .word,
  #mission .depot button,
  #mission .depot [draggable="true"]{
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
    mission.classList.add('sc-uniform-tokens','sc-grid-always-2col');
    mission.dataset.slotCount=String(slots.children.length);
    mission.dataset.wordCount=String(depot.children.length);
  }

  const observer=new MutationObserver(applyGrid);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  applyGrid();

  window.SENTENCE_CITY_MOBILE_GRID={version:VERSION,apply:applyGrid};
})();
