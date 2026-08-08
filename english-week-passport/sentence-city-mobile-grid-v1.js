/* Sentence City • Mobile Uniform Grid V4
 * Every question uses the same 2-column layout.
 * Board row heights are calculated from the actual number of slot/word rows,
 * so choices can never be covered by the Build Sentence control.
 */
(function(){
  'use strict';

  const VERSION='2026-08-08-SC-MOBILE-UNIFORM-GRID-V4-DYNAMIC-ROWS';
  const style=document.createElement('style');
  style.id='scMobileGridStyle';
  style.textContent=`
@media (max-width:720px){
  #mission .board{
    display:grid!important;
    grid-template-rows:12px var(--sc-slot-h,44px) 12px var(--sc-word-h,44px) 44px!important;
    gap:4px!important;
    min-height:0!important;
    max-height:100%!important;
    overflow-y:auto!important;
    overflow-x:hidden!important;
    overscroll-behavior:contain!important;
    padding-bottom:6px!important;
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
    height:auto!important;
    min-height:0!important;
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

  #mission .control{
    position:static!important;
    width:100%!important;
    min-height:44px!important;
    height:44px!important;
    margin:0!important;
    align-self:stretch!important;
    z-index:1!important;
  }
}

@media (max-width:390px){
  #mission .board{
    grid-template-rows:10px var(--sc-slot-h,42px) 10px var(--sc-word-h,42px) 42px!important;
    gap:3px!important;
  }
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
  #mission .control{height:42px!important;min-height:42px!important}
}
`;
  document.head.appendChild(style);

  function gridHeight(count,rowHeight,gap){
    const rows=Math.max(1,Math.ceil(Math.max(0,count)/2));
    return {rows,height:(rows*rowHeight)+((rows-1)*gap)};
  }

  function applyGrid(){
    const mission=document.getElementById('mission');
    const board=mission?.querySelector('.board');
    const slots=document.getElementById('slots');
    const depot=document.getElementById('depot');
    if(!mission||!board||!slots||!depot)return;

    const compact=matchMedia('(max-width:390px)').matches;
    const rowHeight=compact?42:44;
    const gap=compact?5:6;
    const slotInfo=gridHeight(slots.children.length,rowHeight,gap);
    const wordInfo=gridHeight(depot.children.length,rowHeight,gap);

    board.style.setProperty('--sc-slot-h',slotInfo.height+'px');
    board.style.setProperty('--sc-word-h',wordInfo.height+'px');

    mission.classList.add('sc-uniform-tokens','sc-grid-always-2col','sc-dynamic-token-rows');
    mission.dataset.slotCount=String(slots.children.length);
    mission.dataset.wordCount=String(depot.children.length);
    mission.dataset.slotRows=String(slotInfo.rows);
    mission.dataset.wordRows=String(wordInfo.rows);
  }

  let raf=0;
  const schedule=()=>{
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;applyGrid();});
  };
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('resize',schedule,{passive:true});
  applyGrid();

  window.SENTENCE_CITY_MOBILE_GRID={version:VERSION,apply:applyGrid};
})();
