/* CSAI2601 UX Quest • W1 No Subtext v4
 * Scope: W1 only.
 * Removes all explanatory subtext under choice cards during the main question.
 * Students see only the choice title; explanation happens in Reason Check after selection.
 * Visual-text only: preserves data-choice, data-reason, score, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'').toUpperCase();
  if(node()!=='W1')return;
  function style(){
    if($('#uxq-w1-no-subtext-v4-style'))return;
    const s=document.createElement('style');
    s.id='uxq-w1-no-subtext-v4-style';
    s.textContent=`
      .question .option small,
      .question .option p,
      .question .option div:not(.uxqW1NoSubtextBadge),
      .question .uxqMiniCard small,
      .question .uxqMiniCard p,
      .question .uxqDragCard small,
      .question .uxqDragCard p{
        display:none!important;
        visibility:hidden!important;
        height:0!important;
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
      }
      .question .option,
      .question .uxqMiniCard,
      .question .uxqDragCard{
        min-height:118px!important;
        justify-content:center!important;
      }
      .question .option b,
      .question .option strong,
      .question .uxqMiniCard b,
      .question .uxqMiniCard strong,
      .question .uxqDragCard b,
      .question .uxqDragCard strong{
        margin-top:8px!important;
        font-size:1.05rem!important;
        line-height:1.38!important;
      }
      .uxqW1NoSubtextBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.28);color:#e8f3ff;font-weight:900;font-size:.72rem}
    `;
    document.head.appendChild(s);
  }
  function clean(){
    const q=$('.question');
    if(!q||$('.verify')||$('.feedback'))return;
    $$('.question .option,.question .uxqMiniCard,.question .uxqDragCard').forEach(card=>{
      $$('small,p',card).forEach(x=>{x.textContent='';x.hidden=true;x.style.display='none';});
      $$('div',card).forEach(x=>{if(!x.classList.contains('uxqW1NoSubtextBadge')&&!x.querySelector('b,strong')){x.hidden=true;x.style.display='none';}});
    });
    if(!$('.uxqW1NoSubtextBadge',q)){
      const b=document.createElement('div');
      b.className='uxqW1NoSubtextBadge';
      b.textContent='✅ W1 clean choices • no subtext clues';
      const a=q.querySelector('.uxqW1NoSpoilerBadge,.uxqTwoColumnHardLockBadge,.uxqW1StageSpecificBadge');
      if(a)a.insertAdjacentElement('afterend',b); else q.insertBefore(b,q.firstChild);
    }
  }
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();clean();},35)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
