/* CSAI2601 UX Quest • Overflow Fit Fix v1
 * Scope: W1-W15 + B1-B4.
 * Fixes card text overflowing/clipping when the browser is split or viewport is narrow.
 * Visual-only: no scoring, data-choice, data-reason, strict gate, or sheet sync changes.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W1').toUpperCase();
  if(!/^(W([1-9]|1[0-5])|B[1-4])$/.test(node()))return;
  function style(){
    if($('#uxq-overflow-fit-fix-style'))return;
    const s=document.createElement('style');
    s.id='uxq-overflow-fit-fix-style';
    s.textContent=`
      #uxqCanonicalNode{overflow-x:hidden!important}
      .question,.verify,.feedback,.artifact,.result,.summary{box-sizing:border-box!important;max-width:min(100%,1120px)!important}
      .question .options{display:grid!important;gap:14px!important;align-items:stretch!important;grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .question .option,.uxqMiniCard,.uxqDragCard,.verify .option{
        box-sizing:border-box!important;
        height:auto!important;max-height:none!important;min-height:0!important;
        overflow:visible!important;white-space:normal!important;
        word-break:normal!important;overflow-wrap:anywhere!important;
        contain:none!important;
      }
      .question .option b,.question .option strong,.uxqMiniCard b,.uxqMiniCard strong,.uxqDragCard b,.uxqDragCard strong,.verify .option b,.verify .option strong{
        display:block!important;height:auto!important;max-height:none!important;overflow:visible!important;
        white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
        font-size:clamp(.88rem,1.15vw,1.02rem)!important;line-height:1.32!important;
      }
      .question .option small,.uxqMiniCard small,.uxqDragCard small,.verify .option small{
        display:block!important;height:auto!important;max-height:none!important;overflow:visible!important;
        white-space:normal!important;overflow-wrap:anywhere!important;
        font-size:clamp(.76rem,.95vw,.86rem)!important;line-height:1.35!important;
      }
      .question .option span:not(.uxqMiniLane):not(.uxqDragLane),.verify .option span{
        max-height:none!important;overflow:visible!important;white-space:normal!important;overflow-wrap:anywhere!important;
      }
      @media(max-width:1280px){
        .question .options{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .question .option,.uxqMiniCard,.uxqDragCard{padding:14px 16px!important;min-height:132px!important}
      }
      @media(max-width:760px){
        .question .options{grid-template-columns:1fr!important}
        .question .option,.uxqMiniCard,.uxqDragCard{min-height:0!important}
      }
      .verify .options,.verify .choices{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
      @media(max-width:900px){.verify .options,.verify .choices{grid-template-columns:1fr!important}}
      .uxqOverflowFitBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(144,220,255,.10);border:1px solid rgba(144,220,255,.35);color:#d4f4ff;font-weight:900;font-size:.72rem}
    `;
    document.head.appendChild(s);
  }
  function badge(){
    const q=$('.question');
    if(!q||$('.uxqOverflowFitBadge',q))return;
    const b=document.createElement('div');
    b.className='uxqOverflowFitBadge';
    b.textContent='✅ fit fix • text stays inside cards';
    const a=q.querySelector('.uxqW1StageSpecificBadge,.uxqUltimateCleanupBadge,.uxqUltimateGuardBadge,.uxqAdvancedQualityBadge,.uxqFoundationQualityBadge');
    if(a)a.insertAdjacentElement('afterend',b); else q.insertBefore(b,q.firstChild);
  }
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();badge();},80)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
