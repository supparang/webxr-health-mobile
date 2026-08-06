/* Sentence City • Clean Task Layout V2
 * Keeps complete words and full-sentence options readable on mobile.
 */
(function(){
  'use strict';
  const VERSION='2026-08-06-SC-CLEAN-LAYOUT-V2';
  const style=document.createElement('style');
  style.id='scCleanLayoutV2Style';
  style.textContent=`
@media(max-width:720px){
  #mission.sc-context-choice{
    grid-template-rows:auto minmax(118px,16dvh) minmax(0,1fr) 30px!important;
  }
  #mission.sc-context-choice .camera{
    height:16dvh!important;
    min-height:118px!important;
    max-height:160px!important;
  }
  #mission.sc-context-choice .board{
    grid-template-rows:11px minmax(58px,auto) 11px minmax(112px,auto) 40px!important;
    gap:4px!important;
    overflow:visible!important;
  }
  #mission.sc-context-choice .slots,
  #mission.sc-context-choice .depot{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:6px!important;
    overflow:visible!important;
    padding:0 2px!important;
  }
  #mission.sc-context-choice .slot,
  #mission.sc-context-choice .word{
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:auto!important;
    min-height:52px!important;
    padding:7px 10px!important;
    white-space:normal!important;
    word-break:normal!important;
    overflow-wrap:break-word!important;
    hyphens:none!important;
    line-height:1.18!important;
    font-size:clamp(.59rem,2.65vw,.73rem)!important;
    text-align:center!important;
  }
  #mission.sc-context-choice .word{min-height:54px!important}
  #mission.sc-context-choice .control{
    height:40px!important;
    min-height:40px!important;
    font-size:.74rem!important;
  }
  #mission.sc-repair-choice .slot,
  #mission.sc-fill-choice .slot{
    min-width:150px!important;
  }
}
@media(max-width:720px) and (max-height:760px){
  #mission.sc-context-choice{
    grid-template-rows:auto minmax(105px,14dvh) minmax(0,1fr) 28px!important;
  }
  #mission.sc-context-choice .camera{
    height:14dvh!important;
    min-height:105px!important;
    max-height:135px!important;
  }
  #mission.sc-context-choice .board{
    grid-template-rows:10px minmax(48px,auto) 10px minmax(96px,auto) 36px!important;
    gap:3px!important;
  }
  #mission.sc-context-choice .slot,
  #mission.sc-context-choice .word{
    min-height:46px!important;
    padding:5px 8px!important;
    font-size:.57rem!important;
  }
  #mission.sc-context-choice .control{height:36px!important;min-height:36px!important}
}
`;
  document.head.appendChild(style);

  function apply(){
    const mission=document.getElementById('mission');
    if(!mission)return;
    mission.querySelectorAll('.slot,.word').forEach((element)=>{
      element.style.removeProperty('letter-spacing');
      element.setAttribute('dir','ltr');
    });
  }

  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  apply();
  window.SENTENCE_CITY_CLEAN_LAYOUT={version:VERSION,apply};
})();
