/* CSAI2601 UX Quest • Overflow Fit Fix v2
 * Strong container-based card layout fix.
 * Scope: W1-W15 + B1-B4.
 * Fixes clipping when page is visually narrow even if browser viewport is wide.
 * Visual-only: no scoring/data-choice/data-reason/strict-gate/sheet-sync changes.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W1').toUpperCase();
  if(!/^(W([1-9]|1[0-5])|B[1-4])$/.test(node()))return;
  function style(){
    if($('#uxq-overflow-fit-fix-v2-style'))return;
    const s=document.createElement('style');
    s.id='uxq-overflow-fit-fix-v2-style';
    s.textContent=`
      #uxqCanonicalNode{overflow-x:hidden!important}
      #uxqCanonicalNode *{box-sizing:border-box!important}
      .question,.verify,.feedback,.artifact,.result,.summary{max-width:100%!important;overflow:visible!important;contain:none!important}
      .question{container-type:inline-size!important}
      .question .options{
        display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))!important;
        gap:14px!important;
        align-items:stretch!important;
        width:100%!important;
        max-width:100%!important;
        overflow:visible!important;
      }
      .question .option,.uxqMiniCard,.uxqDragCard{
        width:100%!important;
        min-width:0!important;
        height:auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow:visible!important;
        contain:none!important;
        padding:13px 14px!important;
        display:flex!important;
        flex-direction:column!important;
        gap:8px!important;
      }
      .question .option b,.question .option strong,.uxqMiniCard b,.uxqMiniCard strong,.uxqDragCard b,.uxqDragCard strong{
        display:block!important;
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
        white-space:normal!important;
        word-break:normal!important;
        overflow-wrap:break-word!important;
        font-size:clamp(.86rem,1cqi + .55rem,1rem)!important;
        line-height:1.28!important;
      }
      .question .option small,.uxqMiniCard small,.uxqDragCard small{
        display:block!important;
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
        white-space:normal!important;
        word-break:normal!important;
        overflow-wrap:break-word!important;
        font-size:clamp(.74rem,.72cqi + .54rem,.84rem)!important;
        line-height:1.32!important;
        margin-top:auto!important;
      }
      .question .option span:not(.uxqMiniLane):not(.uxqDragLane),.verify .option span{
        display:none!important;
      }
      @container (max-width: 980px){
        .question .options{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @container (max-width: 620px){
        .question .options{grid-template-columns:1fr!important}
      }
      @media(max-width:1180px){
        .question .options{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-width:680px){
        .question .options{grid-template-columns:1fr!important}
      }
      .verify{container-type:inline-size!important}
      .verify .options,.verify .choices{
        display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))!important;
        gap:14px!important;
        width:100%!important;
      }
      .verify .option{
        height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;
        white-space:normal!important;overflow-wrap:break-word!important;contain:none!important;
      }
      .verify .option b,.verify .option strong,.verify .option small{
        height:auto!important;max-height:none!important;overflow:visible!important;white-space:normal!important;overflow-wrap:break-word!important;
      }
      .uxqOverflowFitBadge{display:none!important}
      .uxqOverflowFitV2Badge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(144,220,255,.12);border:1px solid rgba(144,220,255,.45);color:#d4f4ff;font-weight:900;font-size:.72rem}
    `;
    document.head.appendChild(s);
  }
  function badge(){
    const q=$('.question');
    if(!q||$('.uxqOverflowFitV2Badge',q))return;
    const b=document.createElement('div');
    b.className='uxqOverflowFitV2Badge';
    b.textContent='✅ fit v2 • adaptive card columns';
    const a=q.querySelector('.uxqOverflowFitBadge,.uxqW1StageSpecificBadge,.uxqUltimateCleanupBadge,.uxqUltimateGuardBadge,.uxqAdvancedQualityBadge,.uxqFoundationQualityBadge');
    if(a)a.insertAdjacentElement('afterend',b); else q.insertBefore(b,q.firstChild);
  }
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();badge();},60)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
