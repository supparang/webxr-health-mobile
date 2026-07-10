/* CSAI2601 UX Quest • Two Column Hard Lock v1
 * Emergency layout lock for option/reason cards.
 * Scope: W1-W15 + B1-B4.
 * Forces desktop/tablet questions to 2 columns and mobile to 1 column.
 * Prevents text clipping by disabling fixed heights, hidden overflow, transforms, and line clamps.
 * Visual-only: no scoring/data-choice/data-reason/strict-gate/sheet-sync changes.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W1').toUpperCase();
  if(!/^(W([1-9]|1[0-5])|B[1-4])$/.test(node()))return;
  function style(){
    if($('#uxq-two-column-hard-lock-style'))return;
    const s=document.createElement('style');
    s.id='uxq-two-column-hard-lock-style';
    s.textContent=`
      #uxqCanonicalNode,
      #uxqCanonicalNode main,
      #uxqCanonicalNode section,
      #uxqCanonicalNode article,
      #uxqCanonicalNode .game,
      #uxqCanonicalNode .case,
      #uxqCanonicalNode .question,
      #uxqCanonicalNode .verify,
      #uxqCanonicalNode .feedback,
      #uxqCanonicalNode .result,
      #uxqCanonicalNode .summary,
      #uxqCanonicalNode .artifact{
        overflow:visible!important;
        max-height:none!important;
        contain:none!important;
      }
      #uxqCanonicalNode *{
        box-sizing:border-box!important;
        -webkit-line-clamp:unset!important;
        text-overflow:clip!important;
      }
      .question .options,
      #uxqCanonicalNode .question .options,
      .case .question .options{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:16px!important;
        align-items:stretch!important;
        width:100%!important;
        max-width:100%!important;
        overflow:visible!important;
      }
      .question .option,
      #uxqCanonicalNode .question .option,
      .uxqMiniCard,
      .uxqDragCard{
        width:100%!important;
        min-width:0!important;
        height:auto!important;
        min-height:160px!important;
        max-height:none!important;
        overflow:visible!important;
        contain:none!important;
        display:flex!important;
        flex-direction:column!important;
        gap:10px!important;
        padding:16px 17px!important;
        transform:none!important;
      }
      .question .option b,
      .question .option strong,
      .uxqMiniCard b,
      .uxqMiniCard strong,
      .uxqDragCard b,
      .uxqDragCard strong,
      .question .option small,
      .uxqMiniCard small,
      .uxqDragCard small,
      .question .option p,
      .question .option div{
        display:block!important;
        height:auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow:visible!important;
        white-space:normal!important;
        word-break:normal!important;
        overflow-wrap:anywhere!important;
        transform:none!important;
      }
      .question .option b,
      .question .option strong,
      .uxqMiniCard b,
      .uxqMiniCard strong,
      .uxqDragCard b,
      .uxqDragCard strong{
        font-size:1.02rem!important;
        line-height:1.34!important;
      }
      .question .option small,
      .uxqMiniCard small,
      .uxqDragCard small{
        font-size:.86rem!important;
        line-height:1.38!important;
        margin-top:auto!important;
      }
      .question .option span:not(.uxqMiniLane):not(.uxqDragLane),
      .verify .option span{
        display:none!important;
      }
      .verify .options,
      .verify .choices,
      #uxqCanonicalNode .verify .options,
      #uxqCanonicalNode .verify .choices{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:16px!important;
        overflow:visible!important;
      }
      .verify .option,
      #uxqCanonicalNode .verify .option{
        width:100%!important;
        min-width:0!important;
        height:auto!important;
        min-height:150px!important;
        max-height:none!important;
        overflow:visible!important;
        contain:none!important;
        padding:16px 17px!important;
      }
      .verify .option b,
      .verify .option strong,
      .verify .option small,
      .verify .option p,
      .verify .option div{
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
        white-space:normal!important;
        overflow-wrap:anywhere!important;
      }
      @media(max-width:760px){
        .question .options,
        #uxqCanonicalNode .question .options,
        .verify .options,
        .verify .choices,
        #uxqCanonicalNode .verify .options,
        #uxqCanonicalNode .verify .choices{
          grid-template-columns:1fr!important;
        }
        .question .option,
        #uxqCanonicalNode .question .option,
        .uxqMiniCard,
        .uxqDragCard,
        .verify .option,
        #uxqCanonicalNode .verify .option{
          min-height:0!important;
        }
      }
      .uxqOverflowFitV2Badge{display:none!important}
      .uxqTwoColumnHardLockBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(136,255,190,.12);border:1px solid rgba(136,255,190,.48);color:#cfffdf;font-weight:900;font-size:.72rem}
    `;
    document.head.appendChild(s);
  }
  function badge(){
    const q=$('.question');
    if(!q||$('.uxqTwoColumnHardLockBadge',q))return;
    const b=document.createElement('div');
    b.className='uxqTwoColumnHardLockBadge';
    b.textContent='✅ 2-col lock • no clipping';
    const a=q.querySelector('.uxqOverflowFitV2Badge,.uxqOverflowFitBadge,.uxqW1StageSpecificBadge,.uxqUltimateCleanupBadge,.uxqUltimateGuardBadge,.uxqAdvancedQualityBadge,.uxqFoundationQualityBadge');
    if(a)a.insertAdjacentElement('afterend',b); else q.insertBefore(b,q.firstChild);
  }
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();badge();},40)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
